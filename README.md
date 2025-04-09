# Telegram Media Downloader

A web application that allows you to download media (photos, videos, documents) from Telegram chats and channels you have access to.

![App Screenshot](screenshot.png) <!-- Add a screenshot if available -->

## Features

- Secure authentication with Telegram API
- Download media from private chats, groups, and channels
- View media previews before downloading
- Download multiple files at once
- Responsive design works on desktop and mobile

## Prerequisites

- Telegram API ID and Hash from [my.telegram.org](https://my.telegram.org/apps)
- Node.js (v14 or higher)
- npm or yarn

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/telegram-media-downloader.git
   cd telegram-media-downloader
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open your browser and visit:
   ```
   http://localhost:3000
   ```

## Usage

### Authentication Tab:
- Enter your Telegram API ID and Hash
- Provide your phone number in international format (e.g., +1234567890)
- Click "Connect to Telegram"
- Enter the verification code received via Telegram
- Click "Verify Code"

### Download Media Tab:
- Enter a chat ID (numeric) or username (with @)
- Click "Fetch Media"
- Browse the media files
- Click "Download" on any file to save it

### About Tab:
- Contains usage instructions and important notes

## Configuration

For production builds, create a `.env` file with:
```env
REACT_APP_API_ID=your_api_id
REACT_APP_API_HASH=your_api_hash
```

## Troubleshooting

- **"PHONE_NUMBER_INVALID" error**: Ensure your phone number includes country code (e.g., +1 for US)
- **Verification issues**: Try reconnecting if the code doesn't work
- **No media found**: Make sure you have access to the chat and it contains media files

## Important Notes

- This app runs entirely in your browser - your credentials are never sent to any server
- You can only access chats you're a member of
- Respect Telegram's Terms of Service and copyright laws

## Built With

- **React** - Frontend framework
- **Telegram Client Library** - Telegram API integration
- **GramJS** - Telegram client library

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Telegram for their API
- GramJS developers
- All open-source contributors

---

### How to Use This README:

1. Save this as `README.md` in your project root.
2. Customize sections with your specific information:
   - Add your GitHub repository URL
   - Include a screenshot (save as `screenshot.png` in project root)
   - Update any configuration details
   - Add your license file if using something other than MIT
3. For deployment instructions, you might want to add sections for:
   
   ## Deployment
   
   To build for production:
   ```bash
   npm run build
   ```
   Then deploy the build folder to your hosting provider (Netlify, Vercel, GitHub Pages, etc.)
```

Make sure to update the repository URL (`https://github.com/yourusername/telegram-media-downloader.git`) and any other personalized details like the Telegram API keys when using this README in your project.
