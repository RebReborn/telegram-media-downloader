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
    const [selectedItems, setSelectedItems] = useState(new Set());
    const verificationResolver = useRef(null);

    // Cleanup effect
    useEffect(() => {
        return () => {
            verificationResolver.current = null;
            if (client) {
                client.disconnect();
            }
        };
    }, [client]);

    // Connect to Telegram
    const connect = async () => {
        try {
            // Validate inputs
            if (!apiId.match(/^\d+$/)) throw new Error('API ID must be numeric');
            if (!apiHash.match(/^[a-f0-9]{32}$/i)) throw new Error('Invalid API Hash format (32 characters hexadecimal)');
            const cleanPhone = phone.trim();
            if (!cleanPhone.match(/^\+?\d{10,15}$/)) throw new Error('Invalid phone number format. Use +1234567890');

            setAuthStatus({ text: 'Connecting...', type: 'loading' });
            setIsWaitingForCode(false);
            setCode('');

            const sessionKey = 'telegramSession';
            const savedSession = localStorage.getItem(sessionKey) || '';
            const newClient = new TelegramClient(
                new StringSession(savedSession),
                parseInt(apiId),
                apiHash,
                { 
                    connectionRetries: 3,
                    baseLogger: console,
                    useWSS: true
                }
            );

            await newClient.connect();
            await newClient.start({
                phoneNumber: cleanPhone,
                phoneCode: async () => {
                    setAuthStatus({ text: 'Enter verification code sent to your phone', type: 'info' });
                    setIsWaitingForCode(true);
                    return new Promise((resolve) => {
                        verificationResolver.current = resolve;
                    });
                },
                onError: (err) => {
                    setAuthStatus({ text: `Authentication error: ${err.message}`, type: 'error' });
                    setIsWaitingForCode(false);
                },
            });

            const session = newClient.session.save();
            localStorage.setItem(sessionKey, session);
            setClient(newClient);
            setAuthStatus({ text: 'Connected successfully!', type: 'success' });
            setTab('download');
        } catch (err) {
            setAuthStatus({ text: `Connection error: ${err.message}`, type: 'error' });
            setIsWaitingForCode(false);
        }
    };

    // Verify the code
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

    // Fetch media from Telegram chat
    const fetchMedia = async () => {
        if (!chatInput.trim() || !client) {
            setAuthStatus({ text: 'Please connect and enter a chat ID/username', type: 'error' });
            return;
        }

        try {
            setProgress(10);
            setAuthStatus({ text: 'Fetching media...', type: 'loading' });
            const entity = await client.getInputEntity(chatInput.trim());
            setProgress(50);
            const messages = await client.getMessages(entity, { limit: 100 });
            setProgress(80);

            const items = messages
                .filter((m) => m.media)
                .map((m) => {
                    let filename = 'unknown';
                    let fileType = 'file';
                    
                    if (m.photo) {
                        filename = `photo_${m.id}.jpg`;
                        fileType = 'photo';
                    } else if (m.video) {
                        filename = `video_${m.id}.mp4`;
                        fileType = 'video';
                    } else if (m.document) {
                        const fileAttr = m.document.attributes.find((attr) => attr.className === 'DocumentAttributeFilename');
                        filename = fileAttr ? fileAttr.fileName : `file_${m.id}`;
                        fileType = m.document.mimeType || 'file';
                    }
                    return {
                        id: m.id,
                        type: fileType,
                        filename,
                        message: m,
                        size: m.media.document?.size || 0,
                        date: new Date(m.date * 1000).toLocaleString(),
                    };
                });

            setMediaItems(items);
            setProgress(100);
            setAuthStatus({ text: `Found ${items.length} media items`, type: 'success' });
            setTimeout(() => setProgress(0), 1000);
        } catch (err) {
            setAuthStatus({ text: `Fetch error: ${err.message}`, type: 'error' });
            setProgress(0);
        }
    };

    // Download media file
    const downloadFile = async (mediaItem) => {
        if (!client || !mediaItem.message.media) return;

        try {
            setIsDownloading(true);
            setAuthStatus({ text: `Downloading ${mediaItem.filename}...`, type: 'loading' });
            setProgress(0);

            const buffer = await client.downloadMedia(mediaItem.message.media, {
                progressCallback: (received, total) => {
                    const percentage = Math.round((received / total) * 100);
                    setProgress(percentage);
                },
            });

            const blob = new Blob([buffer]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = mediaItem.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 100);

            setAuthStatus({ text: `${mediaItem.filename} downloaded successfully!`, type: 'success' });
        } catch (err) {
            setAuthStatus({ text: `Download failed: ${err.message}`, type: 'error' });
        } finally {
            setIsDownloading(false);
            setProgress(0);
        }
    };

    // Download selected files
    const downloadSelected = async () => {
        if (selectedItems.size === 0) {
            setAuthStatus({ text: 'Please select files to download', type: 'error' });
            return;
        }

        try {
            setIsDownloading(true);
            setAuthStatus({ text: `Downloading ${selectedItems.size} files...`, type: 'loading' });
            
            for (const id of selectedItems) {
                const item = mediaItems.find(m => m.id === id);
                if (item) {
                    await downloadFile(item);
                    // Small delay between downloads
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            setAuthStatus({ text: `Downloaded ${selectedItems.size} files successfully!`, type: 'success' });
        } catch (err) {
            setAuthStatus({ text: `Batch download failed: ${err.message}`, type: 'error' });
        } finally {
            setIsDownloading(false);
            setSelectedItems(new Set());
        }
    };

    // Toggle item selection
    const toggleItemSelection = (id) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedItems(newSelected);
    };

    // Select all items
    const selectAllItems = () => {
        if (selectedItems.size === mediaItems.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(mediaItems.map(item => item.id)));
        }
    };

    // Format file size
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Disconnect from Telegram
    const disconnect = async () => {
        if (client) {
            await client.disconnect();
        }
        localStorage.removeItem('telegramSession');
        setClient(null);
        setTab('auth');
        setAuthStatus({ text: 'Disconnected', type: 'info' });
        setMediaItems([]);
        setSelectedItems(new Set());
    };

    return (
        <div className="App">
            <header className="app-header">
                <h1>Telegram Media Downloader</h1>
                {client && (
                    <button onClick={disconnect} className="disconnect-btn">
                        Disconnect
                    </button>
                )}
            </header>

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
                        <div className="input-group">
                            <label htmlFor="apiId">API ID</label>
                            <input
                                id="apiId"
                                placeholder="API ID (from my.telegram.org)"
                                value={apiId}
                                onChange={(e) => setApiId(e.target.value.trim())}
                                type="text"
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="apiHash">API Hash</label>
                            <input
                                id="apiHash"
                                placeholder="API Hash"
                                value={apiHash}
                                onChange={(e) => setApiHash(e.target.value.trim())}
                                type="password"
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="phone">Phone Number</label>
                            <input
                                id="phone"
                                placeholder="Phone (+1234567890)"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.trim())}
                                type="tel"
                            />
                        </div>
                        <button onClick={connect} className="connect-btn" disabled={isWaitingForCode}>
                            {isWaitingForCode ? 'Waiting for code...' : 'Connect to Telegram'}
                        </button>
                        {isWaitingForCode && (
                            <div className="verification-box">
                                <div className="input-group">
                                    <label htmlFor="code">Verification Code</label>
                                    <input
                                        id="code"
                                        placeholder="Verification Code"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value.trim())}
                                        type="text"
                                        autoFocus
                                    />
                                </div>
                                <button
                                    onClick={verifyCode}
                                    className="verify-btn"
                                    disabled={!code.trim()}
                                >
                                    Verify Code
                                </button>
                            </div>
                        )}
                        {authStatus.text && (
                            <div className={`status ${authStatus.type}`}>{authStatus.text}</div>
                        )}
                    </div>
                )}

                {tab === 'download' && client && (
                    <div className="download-container">
                        <h2>Download Media</h2>
                        <div className="search-container">
                            <div className="input-group">
                                <label htmlFor="chatInput">Chat ID or @username</label>
                                <input
                                    id="chatInput"
                                    placeholder="Chat ID or @username"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    type="text"
                                />
                            </div>
                            <button
                                onClick={fetchMedia}
                                className="fetch-btn"
                                disabled={progress > 0 && progress < 100}
                            >
                                {progress > 0 && progress < 100 ? 'Fetching...' : 'Fetch Media'}
                            </button>
                        </div>
                        
                        {mediaItems.length > 0 && (
                            <div className="media-actions">
                                <button
                                    onClick={selectAllItems}
                                    className="select-all-btn"
                                >
                                    {selectedItems.size === mediaItems.length ? 'Deselect All' : 'Select All'}
                                </button>
                                <button
                                    onClick={downloadSelected}
                                    className="download-selected-btn"
                                    disabled={selectedItems.size === 0 || isDownloading}
                                >
                                    Download Selected ({selectedItems.size})
                                </button>
                            </div>
                        )}
                        
                        <div className="media-grid">
                            {mediaItems.length > 0 ? (
                                mediaItems.map((item) => (
                                    <div 
                                        key={item.id} 
                                        className={`media-item ${selectedItems.has(item.id) ? 'selected' : ''}`}
                                        onClick={() => toggleItemSelection(item.id)}
                                    >
                                        <div className="media-preview">
                                            {item.type.includes('image') ? '📷' : 
                                             item.type.includes('video') ? '🎥' : '📄'}
                                        </div>
                                        <div className="media-info">
                                            <span className="filename" title={item.filename}>{item.filename}</span>
                                            <span className="file-size">{formatFileSize(item.size)}</span>
                                            <span className="file-date">{item.date}</span>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                downloadFile(item);
                                            }}
                                            className="download-btn"
                                            disabled={isDownloading}
                                        >
                                            Download
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state">
                                    {progress > 0 && progress < 100
                                        ? 'Loading media...'
                                        : 'No media found. Enter a chat ID and click "Fetch Media"'}
                                </div>
                            )}
                        </div>
                        {progress > 0 && (
                            <div className="progress-container">
                                <div className="progress-bar" style={{ width: `${progress}%` }}>
                                    {progress}%
                                </div>
                            </div>
                        )}
                        {authStatus.text && (
                            <div className={`status ${authStatus.type}`}>{authStatus.text}</div>
                        )}
                    </div>
                )}

                {tab === 'about' && (
                    <div className="about-container">
                        <h2>About This App</h2>
                        <p>This application allows you to download media from Telegram chats.</p>
                        <h3>How to use:</h3>
                        <ol>
                            <li>Get your API ID and Hash from <a href="https://my.telegram.org" target="_blank" rel="noopener noreferrer">my.telegram.org</a></li>
                            <li>Enter your credentials in the Authentication tab</li>
                            <li>After connecting, go to the Download Media tab</li>
                            <li>Enter a chat ID or username to fetch media</li>
                            <li>Select and download the files you want</li>
                        </ol>
                        <div className="disclaimer">
                            <strong>Note:</strong> This app runs entirely in your browser. Your credentials are not stored or sent to any server.
                            All data remains on your device.
                        </div>
                        <div className="version-info">
                            Version 1.0.0 | Using Telegram Client API
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;