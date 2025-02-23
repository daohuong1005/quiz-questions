// script.js - Phiên bản hoàn chỉnh
const QUIZ_CONFIG = {
    SHEET_API_URL: 'https://script.google.com/macros/s/AKfycbz9T4vW1UAQ0vi3tgu5T6JMpYTgNVIZXneAPr9ynNJh2t6Z1iMC5N2fG7c0oUv9PTpmfQ/exec',
	FALLBACK_QUESTIONS: [
		{
			question: "HTML là viết tắt của gì?",
			answers: [
				{ text: "Hyper Text Markup Language", correct: true },
				{ text: "Home Tool Markup Language", correct: false },
				{ text: "Hyperlinks and Text Markup Language", correct: false },
				{ text: "Hyper Tool Multi Language", correct: false }
			]
		}
    ]
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
};

// ================= GOOGLE SHEET INTEGRATION ================= //

async function loadSheetData() {
    showLoading();
    
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', QUIZ_CONFIG.SHEET_API_URL);
        
        xhr.addEventListener('progress', (e) => {
            if(e.lengthComputable) {
                loadingProgress = (e.loaded / e.total) * 100;
                updateProgressUI();
            }
        });
        
        const data = await new Promise((resolve, reject) => {
            xhr.onload = () => {
                if(xhr.status === 200) resolve(JSON.parse(xhr.response));
                else reject(new Error(xhr.statusText));
            };
            
            xhr.onerror = () => reject(new Error('Lỗi mạng'));
            xhr.send();
        });
        
        if(data.status === 'success') {
            questions = data.data;
            saveQuestions();
            hideLoading();
            initializeQuiz();
        } else {
            throw new Error(data.message);
        }
    } catch(error) {
        hideLoading();
        console.error('Lỗi tải dữ liệu:', error);
        loadLocalQuestions();
    }
}


function showLoading() {
    document.getElementById('loading').style.display = 'flex';
    loadingProgress = 0;
    updateProgressUI();
    
    progressInterval = setInterval(() => {
        if(loadingProgress < 95) {
            loadingProgress += Math.random() * 5;
            updateProgressUI();
        }
    }, 200);
}

function hideLoading() {
    loadingProgress = 100;
    updateProgressUI();
    clearInterval(progressInterval);
    
    setTimeout(() => {
        document.getElementById('loading').style.display = 'none';
    }, 500);
}

function updateProgressUI() {
    const progressBar = document.getElementById('loading-progress');
    const progressText = document.getElementById('loading-text');
    const progress = Math.min(100, Math.floor(loadingProgress));
    
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${progress}%`;
}

// ================= LOCAL STORAGE ================= //
function saveQuestions() {
    localStorage.setItem('quiz-questions', JSON.stringify(questions));
}

function loadLocalQuestions() {
    showLoading();
    
    const fakeProgress = () => {
        if(loadingProgress < 100) {
            loadingProgress += Math.random() * 20;
            updateProgressUI();
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
        const button = document.createElement('button');
        button.className = 'answer-btn';
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
document.addEventListener('DOMContentLoaded', () => {
    // Khởi tạo quiz
	questions ? loadLocalQuestions() : loadSheetData()
    
    // Navigation
    elements.nextButton.addEventListener('click', showNextQuestion);
    elements.prevButton.addEventListener('click', showPreviousQuestion);
    elements.resetButton.addEventListener('click', reloadPage);
	elements.asyncQuestion.addEventListener('click', loadSheetData);
	elements.questionCount.addEventListener('change', loadLocalQuestions);
	
});