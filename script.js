// script.js - Phiên bản hoàn chỉnh

// const QUIZ_CONFIG = {
    // SHEET_ID: '1l0be3pRYRAolPc36I7SMbqtAuHrz3qxDFbINnDjXBVE', // ID Google Sheet
    // API_KEY: 'AIzaSyA02Uf4d2MfMBf9UzUGHYT63HmK-jpq5jc',
    // DEFAULT_SHEET: 'N5_1'
// };

const QUIZ_CONFIG = {
    SHEET_ID: '1l0be3pRYRAolPc36I7SMbqtAuHrz3qxDFbINnDjXBVE',
    API_KEY: 'AIzaSyA02Uf4d2MfMBf9UzUGHYT63HmK-jpq5jc',
    SHEETS_API: 'https://sheets.googleapis.com/v4/spreadsheets/',
    DEFAULT_SHEET: 'N5_1'
};

// Biến toàn cục
let selectedQuestions = []; 
let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let userAnswers = [];
let scoreUpdated = [];
let editingIndex = -1;
let loadingProgress = 0;
let progressInterval;

let currentSheet = QUIZ_CONFIG.DEFAULT_SHEET;
let sheetList = [];

// Thêm biến kiểm soát trạng thái
let isFetching = false;
let abortController = null;

// Thêm flag để ngăn vòng lặp
let isUpdatingSheet = false;

// Hàm lấy danh sách sheet
async function fetchSheetList() {
	if (abortController) abortController.abort();
    abortController = new AbortController();
	
    try {
        isFetching = true;
        const response = await fetch(
            `${QUIZ_CONFIG.SHEETS_API}${QUIZ_CONFIG.SHEET_ID}?key=${QUIZ_CONFIG.API_KEY}`,
            { signal: abortController.signal }
        );
        if(!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        
        const data = await response.json();
        if(!data.sheets) throw new Error('Cấu trúc dữ liệu không hợp lệ');
        
        return data.sheets.map(sheet => sheet.properties.title);
    } catch(error) {
        console.error('Lỗi tải danh sách sheet:', error);
        showErrorToast('Không thể tải danh sách sheet');
        return [];
    }finally {
        isFetching = false;
    }
}

// Hàm cập nhật dropdown sheets
async function updateSheetDropdown() {
	if(isFetching) return; // Chặn gọi trùng
	
	try {
		const sheetSelect = document.getElementById('sheet-select');
		sheetSelect.disabled = true;
		sheetSelect.classList.add('loading-sheets');
		
		sheetList = await fetchSheetList();
		
		sheetSelect.innerHTML = sheetList.length > 0 
			? sheetList.map(sheet => `
				<option value="${sheet}" ${sheet === QUIZ_CONFIG.DEFAULT_SHEET ? 'selected' : ''}>
					${sheet}
				</option>
			`).join('')
			: '<option value="" disabled>Không tìm thấy sheet nào</option>';
		
		currentSheet = sheetSelect.value;
		
		// Event listener khi chọn sheet
		sheetSelect.addEventListener('change', function() {
			currentSheet = this.value;
			localStorage.setItem('last-sheet', currentSheet);
		});
		
		sheetSelect.disabled = false;
		sheetSelect.classList.remove('loading-sheets');
	} catch(error) {
        if(error.name === 'AbortError') {
            console.log('Fetch aborted');
        } else {
            // Xử lý lỗi khác
        }
    }
}


// DOM Elements
const elements = {
    question: document.getElementById("question"),
    answerButtons: document.getElementById("answer-buttons"),
    nextButton: document.getElementById("next-btn"),
    prevButton: document.getElementById("prev-btn"),
    score: document.getElementById("score"),
    quizInterface: document.getElementById("quiz-interface"),
	resetButton: document.getElementById("reset-btn"),
	asyncQuestion : document.getElementById("sync-questions"),
	questionCount : document.getElementById("question-count"),
	sheetSelect: document.getElementById('sheet-select'),
};

// Thêm hàm validate elements
function validateElements() {
    Object.entries(elements).forEach(([name, element]) => {
        if (!element) {
            console.error(`Element ${name} not found!`);
        }
    });
}

// ================= GOOGLE SHEET INTEGRATION ================= //

async function loadSheetData() {
	if(isFetching) return;
	
	if(!currentSheet) {
        alert('Vui lòng chọn một sheet!');
        return;
    }
    
    try {
		isFetching = true;
		showLoading();
		const sheetName = currentSheet;
		const API_URL = `https://sheets.googleapis.com/v4/spreadsheets/${QUIZ_CONFIG.SHEET_ID}/values/${sheetName}?key=${QUIZ_CONFIG.API_KEY}`;

        const response = await fetch(API_URL);
        const data = await response.json();
        
        if(data.error) {
            throw new Error(data.error.message);
        }
        
        questions = processSheetData(data.values);
        saveQuestions();
        initializeQuiz();
    } catch(error) {
        console.error('Lỗi tải dữ liệu:', error);
        alert(`Không tìm thấy sheet "${sheetName}"!`);
        loadLocalQuestions();
    } finally {
        isFetching = false;
        hideLoading();
    }
}

// Hàm xử lý dữ liệu từ Google Sheet
function processSheetData(rows) {
	let questions = [];
    const HEADER_ROW = 0;
    const QUESTION_COL = 0; // Cột chứa câu hỏi
	const CORRECT_ANSWER_COL = 5; // Cột chứa câu hỏi

    // Kiểm tra dữ liệu đầu vào
    if (!rows || rows.length < 2) {
        console.error("Dữ liệu không hợp lệ: không đủ hàng");
        return questions;
    }

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 2) {
            console.warn(`Bỏ qua hàng ${i + 1}: không đủ dữ liệu`);
            continue;
        }

        const questionText = row[QUESTION_COL];
		const correctAnswerIndex = row[CORRECT_ANSWER_COL];
        const answers = [];
        let correctAnswerFound = false;

        // Xử lý các cột đáp án
        for (let col = 1; col < row.length - 1; col++) {
            const answerText = row[col]?.trim() || "";
            
            // Cách 1: Xác định đáp án đúng bằng cột riêng
            if (correctAnswerIndex !== -1) {
                const isCorrect = (col == correctAnswerIndex);
                answers.push({ text: answerText, correct: isCorrect });
                if (isCorrect) correctAnswerFound = true;
            }
        }

        // Validate ít nhất 1 đáp án đúng
        if (!correctAnswerFound) {
            console.error(`Câu hỏi "${questionText}" không có đáp án đúng!`);
            continue;
        }

        questions.push({
            question: questionText,
            answers: answers.filter(a => a.text) // Lọc đáp án trống
        });
    }

    return questions;
}

function showLoading() {
	if(progressInterval) clearInterval(progressInterval); // Clear trước khi tạo mới
	
    document.getElementById('loading').style.display = 'flex';
    loadingProgress = 0;
    	
    
    progressInterval = setInterval(() => {
        if(loadingProgress < 95) {
            loadingProgress += Math.random() * 5;
            	
        }
    }, 200);
}

function hideLoading() {
    loadingProgress = 100;
    	
    clearInterval(progressInterval);
    
    setTimeout(() => {
        document.getElementById('loading').style.display = 'none';
    }, 500);
}


// ================= LOCAL STORAGE ================= //
function saveQuestions() {
    localStorage.setItem('quiz-questions', JSON.stringify(questions));
}

function loadLocalQuestions() {
    showLoading();
    
    const fakeProgress = () => {
        if (loadingProgress >= 100) return; // Điều kiện dừng
    
		loadingProgress += Math.random() * 20;
		
		if (loadingProgress < 100) {
			requestAnimationFrame(fakeProgress);
		}
    };
    
    fakeProgress();
    
    setTimeout(() => {
        const localData = localStorage.getItem('quiz-questions');
        questions = localData ? JSON.parse(localData) : QUIZ_CONFIG.FALLBACK_QUESTIONS;
        hideLoading();
        initializeQuiz();
    }, 800);
}

function getRandomQuestions(n) {
    const shuffled = questions.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
}

// ================= QUIZ ENGINE ================= //
function initializeQuiz() {
    const questionCount = parseInt(document.getElementById('question-count').value);
    selectedQuestions = getRandomQuestions(questionCount);
    
	elements.quizInterface.style.display = 'block';
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];
    scoreUpdated = new Array(selectedQuestions.length).fill(false);
    
    showQuestion(currentQuestionIndex);
}

function showQuestion(index) {
    currentQuestionIndex = index;
    resetState();
    
    const question = selectedQuestions[index];
    elements.question.textContent = question.question;
    
    question.answers.forEach((answer, i) => {
		const col = document.createElement('div');
        col.className = 'col-12 col-md-6 col-lg-4 mb-3'; // Responsive columns
        
        const button = document.createElement('button');
        button.className = 'answer-btn w-100';
        button.innerHTML = `
            <div class="answer-letter">${String.fromCharCode(65 + i)}</div>
            <div class="answer-text">${answer.text}</div>
        `;
        
        if (answer.correct) button.dataset.correct = true;
        if (userAnswers[index] !== undefined) button.disabled = true;
        
        if (userAnswers[index] === i) {
            button.classList.add(answer.correct ? 'correct' : 'wrong');
        }
        
        button.addEventListener('click', selectAnswer);
		col.appendChild(button);
        elements.answerButtons.appendChild(button);
    });
    
    updateNavigation();
    updateProgress();
    updateScore();
}

function resetState() {
    elements.answerButtons.innerHTML = '';
}

function selectAnswer(e) {
    const selectedButton = e.target.closest('.answer-btn');
    const answerIndex = Array.from(elements.answerButtons.children).indexOf(selectedButton);
    const isCorrect = selectedButton.dataset.correct === 'true';
    
    userAnswers[currentQuestionIndex] = answerIndex;
    
    if (isCorrect && !scoreUpdated[currentQuestionIndex]) {
        score++;
        scoreUpdated[currentQuestionIndex] = true;
    }
	else {
		selectedButton.classList.add('wrong')
	}
    
    Array.from(elements.answerButtons.children).forEach(button => {
        button.disabled = true;
        if (button.dataset.correct === 'true') button.classList.add('correct');
    });
    
    updateNavigation();
    updateScore();
}

function updateProgress() {
    const progress = (currentQuestionIndex / selectedQuestions.length) * 100;
    document.querySelector('.progress').style.width = `${progress}%`;
}

function updateScore() {
    elements.score.textContent = `Điểm: ${score}/${selectedQuestions.length}`;
}

function updateNavigation() {
    elements.prevButton.disabled = currentQuestionIndex === 0;
    elements.nextButton.textContent = currentQuestionIndex < selectedQuestions.length - 1 
        ? "Tiếp theo →" 
        : "Kết thúc";
}

function showNextQuestion() {
    if (currentQuestionIndex < selectedQuestions.length - 1) {
        showQuestion(currentQuestionIndex + 1);
    } else {
        endQuiz();
    }
}

function showPreviousQuestion() {
    if (currentQuestionIndex > 0) {
        showQuestion(currentQuestionIndex - 1);
    }
}

function endQuiz() {
    elements.question.textContent = "Bạn đã hoàn thành bài quiz!";
    elements.answerButtons.style.display = 'none';
	elements.prevButton.style.display = 'none';
    elements.nextButton.style.display = 'none';
	elements.resetButton.style.display = 'block';
    elements.score.textContent = `Điểm cuối cùng: ${score}/${selectedQuestions.length}`;
	document.querySelector('.progress').style.width = `100%`;
}

function reloadPage() {
    location.reload(); // Load lại trang
}

// ================= EVENT LISTENERS ================= //
// Thêm cleanup khi unmount
window.addEventListener('beforeunload', () => {
    if(abortController) abortController.abort();
    if(progressInterval) clearInterval(progressInterval);
});

document.addEventListener('DOMContentLoaded', async () => {
	validateElements();
	
	let isInitialized = false;
	
	const init = async () => {
	if(isInitialized) return;
	isInitialized = true;
	
	// Khởi tạo quiz
	questions ? loadLocalQuestions() : loadSheetData()
	
	// Khởi tạo dropdown sheets
	await updateSheetDropdown();
	// Chỉ thêm event listener nếu element tồn tại
	if (elements.sheetSelect) {
		elements.sheetSelect.addEventListener('change', handleSheetChange);
	}
	
	// Navigation
	elements.nextButton.addEventListener('click', showNextQuestion);
	elements.prevButton.addEventListener('click', showPreviousQuestion);
	elements.resetButton.addEventListener('click', reloadPage);
	elements.asyncQuestion.addEventListener('click', loadSheetData);
	elements.questionCount.addEventListener('change', loadLocalQuestions);
    };
	
	
	init();
	
});

function handleSheetChange(e) {
	
	if(isUpdatingSheet) return;
    
    try {
        isUpdatingSheet = true;
        currentSheet = e.target.value.trim() || QUIZ_CONFIG.DEFAULT_SHEET;
		localStorage.setItem('last-sheet', currentSheet);
		loadSheetData();
    } finally {
        isUpdatingSheet = false;
    }
}
