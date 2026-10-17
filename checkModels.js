require('dotenv').config();

async function checkAvailableModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return console.log("Không tìm thấy API Key!");

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log("\n🔍 CÁC MODEL ĐƯỢC PHÉP DÙNG ĐỂ VIẾT VĂN (generateContent):");
    data.models.forEach(model => {
      if (model.supportedGenerationMethods && model.supportedGenerationMethods.includes('generateContent')) {
        // Chỉ in ra những model có chữ 'gemini' để dễ nhìn
        if (model.name.includes('gemini')) {
           console.log(`👉 ${model.name.replace('models/', '')}`);
        }
      }
    });
    console.log("\n");
  } catch (error) {
    console.error("Lỗi:", error);
  }
}

checkAvailableModels();