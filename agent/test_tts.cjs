const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

ai.models.generateContent({
  model: 'gemini-2.5-flash-preview-tts',
  contents: [{ role: 'user', parts: [{ text: 'வணக்கம்' }] }],
  config: {
    responseModalities: ['AUDIO'],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: 'Sulafat' }
      }
    }
  }
}).then(r => {
  const audio = r.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  console.log('Audio received:', !!audio, '| length:', audio?.length);
  if (!audio) {
    console.log('Full response:', JSON.stringify(r, null, 2));
  }
}).catch(e => {
  console.error('ERROR:', e.message);
  console.error('Full error:', e);
});