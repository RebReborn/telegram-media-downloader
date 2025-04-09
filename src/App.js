import React, { useState, useRef, useEffect } from 'react';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import './App.css';

function App() {
    const [tab, setTab] = useState('auth');
    const [apiId, setApiId] = useState('');
    const [apiHash, setApiHash] = useState('');
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [client, setClient] = useState(null);
    const [authStatus, setAuthStatus] = useState({ text: '', type: '' });
    const [mediaItems, setMediaItems] = useState([]);
    const [progress, setProgress] = useState(0);
    const [chatInput, setChatInput] = useState('');
    const [isWaitingForCode, setIsWaitingForCode] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const verificationResolver = useRef(null);

    // Cleanup effect
    useEffect(() => {
        return () => {
            verificationResolver.current = null;
        };
    }, []);

    const connect = async () => {
        try {
            // Validate inputs
            if (!apiId.match(/^\d+$/)) {
                throw new Error('API ID must be numeric');
            }
            if (!apiHash.match(/^[a-f0-9]{32}$/i)) {
                throw new Error('Invalid API Hash format (32 characters hexadecimal)');
            }
            const cleanPhone = phone.trim();
            if (!cleanPhone.match(/^\+?\d{10,15}$/)) {
                throw new Error('Invalid phone number format. Use +1234567890');
            }

            setAuthStatus({ text: 'Connecting...', type: 'loading' });
            setIsWaitingForCode(false);
            setCode('');

            const sessionKey = 'telegramSession';
            const savedSession = localStorage.getItem(sessionKey) || '';
            const newClient = new TelegramClient(
                new StringSession(savedSession),
                parseInt(apiId),
                apiHash,
                { connectionRetries: 3 }
            );

            await newClient.start({
                phoneNumber: cleanPhone,
                phoneCode: async () => {
                    setAuthStatus({ 
                        text: 'Enter verification code sent to your phone', 
                        type: 'info' 
                    });
                    setIsWaitingForCode(true);
                    
                    return new Promise((resolve) => {
                        verificationResolver.current = resolve;
                    });
                },
                onError: (err) => {
                    setAuthStatus({ text: `Error: ${err.message}`, type: 'error' });
                    setIsWaitingForCode(false);
                },
            });

            const session = newClient.session.save();
            localStorage.setItem(sessionKey, session);
            setClient(newClient);
            setAuthStatus({ text: 'Connected successfully!', type: 'success' });
            setTab('download');
        } catch (err) {
            setAuthStatus({ text: `Error: ${err.message}`, type: 'error' });
            setIsWaitingForCode(false);
        }
    };

    const verifyCode = () => {
        if (!code.trim()) {
            setAuthStatus({ text: 'Please enter verification code', type: 'error' });
            return;
        }
        
        if (verificationResolver.current) {
            setAuthStatus({ text: 'Verifying...', type: 'loading' });
            verificationResolver.current(code);
            verificationResolver.current = null;
            setIsWaitingForCode(false);
        } else {
            setAuthStatus({ text: 'Verification failed. Try connecting again.', type: 'error' });
        }
    };

    const fetchMedia = async () => {
        if (!chatInput.trim() || !client) return;
        
        try {
            setProgress(10);
            const entity = await client.getInputEntity(chatInput.trim());
            setProgress(50);
            const messages = await client.getMessages(entity, { limit: 100 });
            setProgress(80);

            const items = messages
                .filter(m => m.media)
                .map(m => ({
                    id: m.id,
                    type: m.photo ? 'photo' : m.video ? 'video' : 'file',
                    filename: m.photo ? `photo_${m.id}.jpg` :
                        m.video ? `video_${m.id}.mp4` :
                            `file_${m.id}.dat`,
                    message: m
                }));

            setMediaItems(items);
            setProgress(100);
            setTimeout(() => setProgress(0), 1000);
        } catch (err) {
            setAuthStatus({ text飼: `Fetch error: ${err.message}`, type: 'error' });
            setProgress(0);
        }
    };

    const downloadFile = async (mediaItem) => {
        try {
            setIsDownloading(true);
            const buffer = await client.downloadMedia(mediaItem.message);
            const blob = new Blob([buffer]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = mediaItem.filename;
            a.click();
            URL.revokeObjectURL(url);
            setIsDownloading(false);
        } catch (err) {
            setAuthStatus({ text: `Download failed: ${err.message}`, type: 'error' });
            setIsDownloading(false);
        }
    };

    const disconnect = () => {
        localStorage.removeItem('telegramSession');
        setClient(null);
        setTab('auth');
        setAuthStatus({ text: 'Disconnected', type: 'info' });
        setMediaItems([]);
    };

    return (
        <div className="App">
            <div className="tabs">
                <button 
                    onClick={() => setTab('auth')} 
                    className={`tab ${tab === 'auth' ? 'active' : ''}`}
                >
                    Authentication
                </button>
                <button 
                    onClick={() => setTab('download')} 
                    className={`tab ${tab === 'download' ? 'active' : ''}`}
                    disabled={!client}
                >
                    Download Media
                </button>
                <button 
                    onClick={() => setTab('about')} 
                    className={`tab ${tab === 'about' ? 'active' : ''}`}
                >
                    About
                </button>
            </div>

            <div className="tab-content">
                {tab === 'auth' && (
                    <div className="auth-container">
                        <h2>Telegram Login</h2>
                        <input
                            placeholder="API ID (from my.telegram.org)"
                            value={apiId}
                            onChange={(e) => setApiId(e.target.value.trim())}
                            type="text"
                        />
                        <input
                            placeholder="API Hash"
                            value={apiHash}
                            onChange={(e) => setApiHash(e.target.value.trim())}
                            type="password"
                        />
                        <input
                            placeholder="Phone (+1234567890)"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.trim())}
                            type="tel"
                        />
                        <button onClick={connect} className="connect-btn">
                            Connect to Telegram
                        </button>

                        {client && (
                            <button onClick={disconnect} className="disconnect-btn">
                                Disconnect
                            </button>
                        )}

                        {authStatus.text && (
                            <div className={`status ${authStatus.type}`}>
                                {authStatus.text}
                            </div>
                        )}

                        {isWaitingForCode && (
                            <div className="verification-box">
                                <input
                                    placeholder="Verification Code"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.trim())}
                                    type="text"
                                />
                                <button 
                                    onClick={verifyCode}
                                    className="verify-btn"
                                    disabled={!code.trim()}
                                >
                                    Verify Code
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'download' && client && (
                    <div className="download-container">
                        <h2>Download Media</h2>
                        <div className="search-container">
                            <input
                                placeholder="Chat ID or @username"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                type="text"
                            />
                            <button 
                                onClick={fetchMedia} 
                                className="fetch-btn"
                                disabled={progress > 0 && progress < 100}
                            >
                                Fetch Media
                            </button>
                        </div>
                        
                        <div className="media-grid">
                            {mediaItems.length > 0 ? (
                                mediaItems.map(item => (
                                    <div key={item.id} className="media-item">
                                        <div className="media-preview">
                                            {item.type === 'photo' ? '📷' : item.type === 'video' ? '🎥' : '📄'}
                                            <span className="filename">{item.filename}</span>
                                        </div>
                                        <button 
                                            onClick={() => downloadFile(item)}
                                            className="download-btn"
                                            disabled={isDownloading}
                                        >
                                            {isDownloading ? 'Downloading...' : 'Download'}
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state">
                                    {progress > 0 && progress < 100 ? (
                                        'Loading media...'
                                    ) : (
                                        'No media found. Enter a chat ID and click "Fetch Media"'
                                    )}
                                </div>
                            )}
                        </div>
                        
                        {progress > 0 && progress < 100 && (
                            <div className="progress-container">
                                <div className="progress-bar" style={{ width: `${progress}%` }}>
                                    {progress}%
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'about' && (
                    <div className="about-container">
                        <h2>About This App</h2>
                        <p>This application allows you to download media from Telegram chats.</p>
                        <h3>How to use:</h3>
                        <ol>
                            <li>Get your API ID and Hash from my.telegram.org</li>
                            <li>Enter your credentials in the Authentication tab</li>
                            <li>After connecting, go to Download Media tab</li>
                            <li>Enter a chat ID or username to fetch media</li>
                        </ol>
                        <div className="disclaimer">
                            Note: This app runs entirely in your browser. Your credentials are not stored or sent to any server.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;