import 'dotenv/config';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.log('No API key found. Make sure your .env file is set.');
  process.exit(1);
}

const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
);
const data = await response.json();

if (data.error) {
  console.log('Error:', JSON.stringify(data.error, null, 2));
} else {
  console.log('Available models:');
  data.models?.forEach(m => {
    console.log(`${m.name} (${m.supportedGenerationMethods?.join(', ')})`);
  });
}
