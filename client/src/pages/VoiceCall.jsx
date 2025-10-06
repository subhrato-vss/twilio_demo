import React, {useState, useEffect, useRef} from 'react';
import {Device} from '@twilio/voice-sdk';

const VoiceCall = ({userId}) => {
    const [device, setDevice] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [customerNumber, setCustomerNumber] = useState('+918837743572');
    const [callStatus, setCallStatus] = useState('');
    const [currentCall, setCurrentCall] = useState(null);
    const [audioDevices, setAudioDevices] = useState({speakers: [], microphones: []});
    const [selectedSpeaker, setSelectedSpeaker] = useState('');
    const deviceRef = useRef(null);

    // Initialize Twilio Device
    useEffect(() => {
        const initDevice = async () => {
            try {
                // Request microphone permission first
                console.log('🎤 Requesting microphone permission...');
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({audio: true});
                    stream.getTracks().forEach(track => track.stop()); // Stop the stream, we just needed permission
                    console.log('✅ Microphone permission granted');
                } catch (permError) {
                    console.error('❌ Microphone permission denied:', permError);
                    setCallStatus('Microphone permission required for calls');
                    return;
                }

                const url = 'http://45.120.138.200:8081/token';

                // Get access token from your backend
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({identity: userId})
                });

                if (!response.ok) {
                    throw new Error('Failed to get access token');
                }

                const {token} = await response.json();

                // Create and setup Twilio Device
                const newDevice = new Device(token, {
                    // Enable debugging
                    logLevel: 1,
                    // Audio settings
                    codecPreferences: ['opus', 'pcmu'],
                });

                // Load available audio devices
                const loadAudioDevices = async () => {
                    try {
                        const devices = await navigator.mediaDevices.enumerateDevices();
                        const speakers = devices.filter(device => device.kind === 'audiooutput');
                        const microphones = devices.filter(device => device.kind === 'audioinput');

                        console.log('🔊 Available speakers:', speakers);
                        console.log('🎤 Available microphones:', microphones);

                        setAudioDevices({speakers, microphones});

                        // Set default speaker if available
                        if (speakers.length > 0) {
                            await newDevice.audio.speakerDevices.set(speakers[0].deviceId);
                            setSelectedSpeaker(speakers[0].deviceId);
                            console.log('🔊 Default speaker set:', speakers[0].label);
                        }
                    } catch (error) {
                        console.error('Error loading audio devices:', error);
                    }
                };

                await loadAudioDevices();

                // Device event listeners
                newDevice.on('ready', () => {
                    console.log('Twilio Device is ready');
                    setCallStatus('Ready to make calls');
                });

                newDevice.on('error', (error) => {
                    console.error('Twilio Device error:', error);

                    // Handle common trial account errors
                    if (error.code === 21218) {
                        setCallStatus('Error: Number not verified (Trial Account)');
                    } else if (error.code === 21606) {
                        setCallStatus('Error: Number not reachable');
                    } else {
                        setCallStatus(`Error: ${error.message}`);
                    }
                });

                newDevice.on('connect', (call) => {
                    console.log('✅ Call connected:', call);
                    console.log('Call parameters:', call.parameters);

                    // Audio debugging
                    console.log('🔊 Audio context state:', newDevice.audio);
                    console.log('🎤 Input device:', newDevice.audio.inputDevice);
                    console.log('🔊 Output devices:', newDevice.audio.speakerDevices);

                    setIsConnected(true);
                    setIsConnecting(false);
                    setCurrentCall(call);
                    setCallStatus('Connected - You should hear customer audio now');

                    // Ensure audio is unmuted and volume is up
                    call.mute(false);
                });

                newDevice.on('disconnect', (call) => {
                    console.log('Call disconnected');
                    setIsConnected(false);
                    setIsConnecting(false);
                    setCurrentCall(null);
                    setCallStatus('Call ended');
                });

                newDevice.on('incoming', (call) => {
                    console.log('Incoming call from:', call.parameters.From);

                    // Auto-accept incoming calls or show UI to accept/reject
                    if (confirm(`Incoming call from ${call.parameters.From}. Accept?`)) {
                        call.accept();
                    } else {
                        call.reject();
                    }
                });

                // Register the device
                await newDevice.register();

                setDevice(newDevice);
                deviceRef.current = newDevice;

            } catch (error) {
                console.error('Device initialization failed:', error);
                setCallStatus(`Initialization failed: ${error.message}`);
            }
        };

        if (userId) {
            initDevice();
        }

        // Cleanup on unmount
        return () => {
            if (deviceRef.current) {
                deviceRef.current.destroy();
            }
        };
    }, [userId]);

    // Make a call
    const makeCall = async () => {
        if (!device || !customerNumber) {
            alert('Please enter a customer number');
            return;
        }

        try {
            setIsConnecting(true);
            setCallStatus('Calling...');

            // Format the number (remove any non-digits except +)
            const formattedNumber = customerNumber.replace(/[^\d+]/g, '');

            const call = await device.connect({
                params: {
                    To: formattedNumber
                }
            });

            console.log('📞 Call initiated:', call);
            console.log('Call SID:', call.parameters?.CallSid);
            console.log('Calling:', formattedNumber);

        } catch (error) {
            console.error('Failed to make call:', error);
            setCallStatus(`Call failed: ${error.message}`);
            setIsConnecting(false);
        }
    };

    // End the current call
    const hangUp = () => {
        if (currentCall) {
            currentCall.disconnect();
        }
    };

    // Test audio output
    const testAudio = () => {
        if (device) {
            // Test with a beep sound
            device.audio.outgoing(true);
            setTimeout(() => {
                device.audio.outgoing(false);
            }, 1000);
        }
    };

    // Change speaker device
    const changeSpeaker = async (deviceId) => {
        if (device && deviceId) {
            try {
                await device.audio.speakerDevices.set(deviceId);
                setSelectedSpeaker(deviceId);
                console.log('🔊 Speaker changed to:', deviceId);
                setCallStatus('Speaker changed successfully');
            } catch (error) {
                console.error('Error changing speaker:', error);
            }
        }
    };

    // Mute/unmute
    const toggleMute = () => {
        if (currentCall) {
            if (currentCall.isMuted()) {
                currentCall.mute(false);
                setCallStatus('Connected - Unmuted');
            } else {
                currentCall.mute(true);
                setCallStatus('Connected - Muted');
            }
        }
    };

    return (
        <div className="voice-call-container" style={{padding: '20px', maxWidth: '400px'}}>
            <h3>Voice Call System</h3>

            <div style={{marginBottom: '10px'}}>
                <strong>Status:</strong> {callStatus}
            </div>

            {device && (
                <div style={{marginBottom: '15px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px'}}>
                    <h4>Audio Settings</h4>

                    <div style={{marginBottom: '10px'}}>
                        <label>Speaker: </label>
                        <select
                            value={selectedSpeaker}
                            onChange={(e) => changeSpeaker(e.target.value)}
                            style={{marginLeft: '5px', padding: '4px'}}
                        >
                            <option value="">Default</option>
                            {audioDevices.speakers.map(speaker => (
                                <option key={speaker.deviceId} value={speaker.deviceId}>
                                    {speaker.label || `Speaker ${speaker.deviceId.slice(0, 8)}...`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={testAudio}
                        style={{
                            padding: '5px 10px',
                            backgroundColor: '#FF9800',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        Test Audio
                    </button>
                </div>
            )}

            <div style={{marginBottom: '15px'}}>
                <input
                    type="tel"
                    placeholder="Customer phone number (+1234567890)"
                    value={customerNumber}
                    onChange={(e) => setCustomerNumber(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '8px',
                        marginBottom: '10px',
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                    }}
                />
            </div>

            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
                <button
                    onClick={makeCall}
                    disabled={!device || isConnecting || isConnected || !customerNumber}
                    style={{
                        padding: '10px 15px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        opacity: (!device || isConnecting || isConnected || !customerNumber) ? 0.6 : 1
                    }}
                >
                    {isConnecting ? 'Connecting...' : 'Call'}
                </button>

                <button
                    onClick={hangUp}
                    disabled={!isConnected}
                    style={{
                        padding: '10px 15px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        opacity: !isConnected ? 0.6 : 1
                    }}
                >
                    Hang Up
                </button>
            </div>

            {isConnected && (
                <div style={{display: 'flex', gap: '10px'}}>
                    <button
                        onClick={toggleMute}
                        style={{
                            padding: '10px 15px',
                            backgroundColor: '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        {currentCall && currentCall.isMuted() ? 'Unmute' : 'Mute'}
                    </button>
                </div>
            )}

            <div style={{marginTop: '20px', fontSize: '12px', color: '#666'}}>
                <p><strong>Trial Account Notes:</strong></p>
                <ul style={{margin: '5px 0', paddingLeft: '20px'}}>
                    <li>Only verified numbers can be called</li>
                    <li>Calls include trial account message</li>
                    <li>Test numbers: +15005550006 (valid), +15005550001 (invalid)</li>
                </ul>
                <p>Enter customer phone number with country code (e.g., +1234567890)</p>
            </div>
        </div>
    );
};

export default VoiceCall;