# Nano-GPT API Integration

## Setup Instructions

### 1. Get Nano-GPT API Key
1. Go to [nano-gpt.com](https://nano-gpt.com)
2. Sign up or login to your account
3. Navigate to API section
4. Generate your API key

### 2. Configure API Key
Edit the `.env` file in the backend directory:

```bash
cd backend
nano .env
```

Add your API key:
```
NANO_GPT_API_KEY=your_actual_api_key_here
```

### 3. Install Additional Dependencies
```bash
cd backend
source venv/bin/activate
pip install httpx==0.25.2 python-dotenv==1.0.0
```

### 4. Restart the Backend
Stop and restart the FastAPI server:
```bash
source venv/bin/activate
python app/main.py
```

## Features

The Nano-GPT integration provides:
- **Real AI-powered article generation** using DeepSeek v3.2 model
- **SEO-optimized content** with proper keyword integration
- **Multiple tone options** (professional, casual, formal)
- **Automatic length adjustment** to meet target word count
- **Fallback to templates** if API is unavailable

## API Configuration

- **Endpoint**: `https://nano-gpt.com/api/v1/chat/completions`
- **Model**: `deepseek-v3.2-exp-original`
- **Temperature**: 0.7 (balanced creativity)
- **Max Tokens**: Up to 4000 tokens

## Error Handling

If the Nano-GPT API fails for any reason:
1. The system automatically falls back to template-based generation
2. Error messages are logged in the backend console
3. The frontend continues to work with generated content

## Troubleshooting

**Common Issues:**
1. **"NANO_GPT_API_KEY not found"** - Check your .env file
2. **"API request failed"** - Verify your API key is valid and has credits
3. **"Invalid API response format"** - The API might be experiencing issues

**Solutions:**
- Ensure the API key is correctly set in `.env`
- Check your nano-gpt account balance
- Restart the backend server after changing configuration