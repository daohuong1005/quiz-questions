require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const app = express();
const sheets = google.sheets('v4');

// Cấu hình
const config = {
  sheetId: process.env.SHEET_ID,
  apiKey: process.env.API_KEY,
  port: process.env.PORT || 3000
};

// Middleware
app.use(express.json());
// Thêm path module
const path = require('path');
// Sửa dòng static files thành
app.use(express.static(path.join(__dirname, '../client')));

// API Endpoints
app.get('/api/sheets', async (req, res) => {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: config.sheetId,
      key: config.apiKey
    });
    const sheetsList = response.data.sheets.map(s => s.properties.title);
    res.json(sheetsList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/questions/', async (req, res) => {
  try {
    const { sheet } = req.query;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: sheet,
      key: config.apiKey
    });
    const questions = processSheetData(response.data.values);
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function processSheetData(rows) {
  // Thêm validation
  if (!rows || rows.length < 2) {
    console.error('Dữ liệu không hợp lệ từ Google Sheets');
    return [];
  }

  return rows.slice(1).map((row, index) => {
    // Thêm validation cho từng dòng
    if (row.length < 6) {
      console.warn(`Bỏ qua dòng ${index + 1}: thiếu dữ liệu`);
      return null;
    }
    
    const correctAnswer = parseInt(row[5]);
    if (isNaN(correctAnswer) || correctAnswer < 1 || correctAnswer > 4) {
      console.warn(`Dòng ${index + 1}: Đáp án đúng không hợp lệ`);
      return null;
    }

    return {
      question: row[0].trim(),
      answers: row.slice(1, 5).map(a => a.trim()),
      correct: correctAnswer - 1 // Chuyển từ 1-4 sang 0-3
    };
  }).filter(Boolean); // Lọc các dòng không hợp lệ
}

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});