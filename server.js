const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { Document, Packer } = require('docx');
const natural = require('natural');

// Initialize app
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure storage for Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir); // uploads directory
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage: storage });

// Function to extract text from a PDF file
const extractTextFromPDF = (filePath) => {
  const dataBuffer = fs.readFileSync(filePath);
  return pdfParse(dataBuffer).then((data) => data.text);
};

// Function to extract text from a DOCX file
const extractTextFromDOCX = (filePath) => {
  return "Extracted DOCX content"; // Placeholder for DOCX parsing logic
};

// Function to extract top N keywords from text using TF-IDF
const extractKeywords = (text, topN = 50) => {
  const TfIdf = natural.TfIdf;
  const tfidf = new TfIdf();
  tfidf.addDocument(text);

  const keywords = [];
  // Get top N terms
  tfidf.listTerms(0).slice(0, topN).forEach((item) => {
    keywords.push(item.term);
  });

  return keywords;
};

// Function to compare keywords and generate feedback
const compareKeywords = (resumeKeywords, jobDescKeywords) => {
  const matchedKeywords = resumeKeywords.filter(keyword => jobDescKeywords.includes(keyword));
  const missingKeywords = jobDescKeywords.filter(keyword => !resumeKeywords.includes(keyword));

  return {
    matchPercentage: (matchedKeywords.length / jobDescKeywords.length) * 100,
    matchedKeywords,
    missingKeywords
  };
};

// Route to upload resume and job description
app.post('/upload', upload.fields([{ name: 'resume' }, { name: 'jobDescription' }]), async (req, res) => {
  try {
    const resumeFile = req.files['resume'] ? req.files['resume'][0] : null;
    const jobDescFile = req.files['jobDescription'] ? req.files['jobDescription'][0] : null;

    if (!resumeFile || !jobDescFile) {
      return res.status(400).json({ message: 'Both resume and job description are required.' });
    }

    let resumeText = '';
    let jobDescText = '';

    // Parse resume based on file type
    if (resumeFile.mimetype === 'application/pdf') {
      resumeText = await extractTextFromPDF(resumeFile.path);
    } else if (resumeFile.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      resumeText = await extractTextFromDOCX(resumeFile.path);
    }

    // Parse job description based on file type
    if (jobDescFile.mimetype === 'application/pdf') {
      jobDescText = await extractTextFromPDF(jobDescFile.path);
    } else if (jobDescFile.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      jobDescText = await extractTextFromDOCX(jobDescFile.path);
    }

    // Extract keywords from resume and job description
    const resumeKeywords = extractKeywords(resumeText, 50);
    const jobDescKeywords = extractKeywords(jobDescText, 50);

    // Compare the keywords and generate feedback
    const feedback = compareKeywords(resumeKeywords, jobDescKeywords);

    // Send the comparison results and feedback in response
    res.status(200).json({
      message: 'Files uploaded, parsed, and feedback generated successfully',
      resumeKeywords,
      jobDescKeywords,
      feedback
    });
  } catch (error) {
    console.error('Error processing files:', error);
    res.status(500).json({ message: 'Error processing files', error });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
