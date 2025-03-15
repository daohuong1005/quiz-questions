class QuizApp {
    constructor() {
        this.initializeElements();
        this.initializeVariables();
        this.initializeEventListeners();
        this.initializeQuiz();
    }

    initializeElements() {
        this.elements = {
            question: document.getElementById("question"),
            answerButtons: document.getElementById("answer-buttons"),
            nextButton: document.getElementById("next-btn"),
            prevButton: document.getElementById("prev-btn"),
            score: document.getElementById("score"),
            quizInterface: document.getElementById("quiz-interface"),
            resetButton: document.getElementById("reset-btn"),
            asyncQuestion: document.getElementById("sync-questions"),
            questionCount: document.getElementById("question-count"),
            sheetSelect: document.getElementById('sheet-select')
        };
    }

    initializeVariables() {
        this.selectedQuestions = [];
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.userAnswers = [];
        this.scoreUpdated = [];
        this.currentSheet = localStorage.getItem('last-sheet') || 'N5';
    }

    async initializeQuiz() {
        await this.loadSheetNames();
        await this.loadQuestions();
    }

    async loadSheetNames() {
        try {
            const response = await fetch('/api/sheets');
            const sheets = await response.json();
            this.populateSheetSelect(sheets);
        } catch (error) {
            console.error('Lỗi tải sheets:', error);
        }
    }

    populateSheetSelect(sheets) {
        const select = this.elements.sheetSelect;
        select.innerHTML = sheets.map(sheet => `
            <option value="${sheet}" ${sheet === this.currentSheet ? 'selected' : ''}>
                ${sheet}
            </option>
        `).join('');
          
        select.addEventListener('change', () => this.handleSheetChange());
    }

    async handleSheetChange() {
        this.currentSheet = this.elements.sheetSelect.value;

        await this.loadQuestions();
    }

    async loadQuestions() {
        try {
            this.showLoading();
            const response = await fetch(`/api/questions?sheet=${this.currentSheet}`);
            this.questions = await response.json();
            this.startQuiz();

            // Cập nhật badge hiển thị sheet
            document.getElementById('current-sheet').textContent = `Sheet: ${this.currentSheet}`;
        } catch (error) {
            console.error('Lỗi tải câu hỏi:', error);
        } finally {
            this.hideLoading();
        }
    }

    startQuiz() {
        this.resetQuizState();
        const questionCount = parseInt(this.elements.questionCount.value);
        this.selectedQuestions = this.getRandomQuestions(questionCount);
        this.showQuestion(0);
    }

    getRandomQuestions(n) {
        return [...this.questions]
            .sort(() => 0.5 - Math.random())
            .slice(0, n);
    }

    resetQuizState() {
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.userAnswers = [];
        this.scoreUpdated = [];
        this.selectedQuestions = [];
    }

    handleReset(){
        // Giữ nguyên sheet hiện tại
        localStorage.setItem('last-sheet', this.currentSheet);
        // Reset toàn bộ trạng thái quiz
        this.resetQuizState();
        this.startQuiz();
    };

    showQuestion(index) {
        this.currentQuestionIndex = index;
        this.resetAnswerButtons();
        const question = this.selectedQuestions[index];
        if(question)
        {
            this.elements.question.textContent = question.question;
            question.answers.forEach((answer, i) => {
                this.createAnswerButton(answer, i);
            });
        }
        else
        {
            this.resetQuizState();
            this.elements.question.textContent = '';
            this.resetAnswerButtons();
        }
        
        this.updateNavigation();
        this.updateProgress();
        this.updateScore();
    }

    createAnswerButton(answer, index) {
        const button = document.createElement('button');
        button.className = 'answer-btn col-12 col-md-6 mb-3';
        button.innerHTML = `
            <div class="answer-letter">${String.fromCharCode(65 + index)}</div>
            <div class="answer-text">${answer}</div>
        `;
        
        if (index === this.selectedQuestions[this.currentQuestionIndex].correct) {
            button.dataset.correct = true;
        }
        
        button.addEventListener('click', (e) => this.handleAnswer(e, index));
        this.elements.answerButtons.appendChild(button);
    }

    handleAnswer(event, selectedIndex) {
        const isCorrect = selectedIndex === this.selectedQuestions[this.currentQuestionIndex].correct;
        this.userAnswers[this.currentQuestionIndex] = selectedIndex;
        
        if (isCorrect && !this.scoreUpdated[this.currentQuestionIndex]) {
            this.score++;
            this.scoreUpdated[this.currentQuestionIndex] = true;
        }
        
        this.showAnswerFeedback(isCorrect);
        this.updateScore();
    }

    showAnswerFeedback(isCorrect) {
        const buttons = this.elements.answerButtons.children;
        Array.from(buttons).forEach(button => {
            button.disabled = true;
            if (button.dataset.correct === 'true') {
                button.classList.add('correct');
            }
        });
        
        if (!isCorrect) {
            buttons[this.userAnswers[this.currentQuestionIndex]].classList.add('wrong');
        }
    }

    updateNavigation() {
        this.elements.prevButton.disabled = this.currentQuestionIndex === 0;
        this.elements.nextButton.textContent = 
            this.currentQuestionIndex < this.selectedQuestions.length - 1 
                ? "Tiếp theo →" 
                : "Kết thúc";
    }

    updateProgress() {
        // Tính % tiến độ hoàn thành
        let progressPercent = 0;
        if(this.selectedQuestions.length > 0)
        {
            progressPercent = ((this.currentQuestionIndex + 1) / this.selectedQuestions.length) * 100;
        }
        
        // Cập nhật progress bar
        const progressBar = document.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.style.width = `${progressPercent}%`;
            progressBar.setAttribute('aria-valuenow', progressPercent);
            // progressBar.textContent = `${Math.round(progressPercent)}%`;
        }
    }

    updateScore() {
        // Tính toán điểm số
        const scoreText = `Điểm: ${this.score}/${this.selectedQuestions.length}`;
        
        // Cập nhật lên giao diện
        const scoreElement = document.getElementById('score');
        if (scoreElement) {
            scoreElement.textContent = scoreText;
            
            // Thêm animation khi thay đổi điểm
            scoreElement.classList.add('score-update');
            setTimeout(() => {
                scoreElement.classList.remove('score-update');
            }, 300);
        }
    }

    showLoading() {
        document.getElementById('loading').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    initializeEventListeners() {
        this.elements.nextButton.addEventListener('click', () => this.handleNext());
        this.elements.prevButton.addEventListener('click', () => this.handlePrev());
        this.elements.resetButton.addEventListener('click', () => this.handleReset());
        this.elements.asyncQuestion.addEventListener('click', () => this.loadQuestions());
        this.elements.questionCount.addEventListener('change', () => this.startQuiz());
    }

    handleNext() {
        if (this.currentQuestionIndex < this.selectedQuestions.length - 1) {
            this.showQuestion(this.currentQuestionIndex + 1);
        } else {
            this.endQuiz();
        }
    }

    handlePrev() {
        if (this.currentQuestionIndex > 0) {
            this.showQuestion(this.currentQuestionIndex - 1);
        }
    }

    endQuiz() {
        this.elements.question.textContent = "Bạn đã hoàn thành bài quiz!";
        this.elements.answerButtons.innerHTML = '';
        this.elements.score.textContent = `Điểm cuối cùng: ${this.score}/${this.selectedQuestions.length}`;
        this.elements.nextButton.style.display = 'none';
        this.elements.prevButton.style.display = 'none';
    }

    resetAnswerButtons() {
        this.elements.answerButtons.innerHTML = '';
    }

    updateScore() {
        this.elements.score.textContent = `Điểm: ${this.score}/${this.selectedQuestions.length}`;
    }
}

// Khởi động ứng dụng
document.addEventListener('DOMContentLoaded', () => new QuizApp());