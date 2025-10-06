import React, {useState, useEffect, useRef} from 'react';
import {Device} from '@twilio/voice-sdk';

const VoiceCall = ({userId}) => {
    const [device, setDevice] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [customerNumber, setCustomerNumber] = useState('+918837743572');
    const [callStatus, setCallStatus] = useState('');
    const [currentCall, setCurrentCall] = useState(null);
    const deviceRef = useRef(null);

    // Initialize Twilio Device
    useEffect(() => {
        const initDevice = async () => {
            try {
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
                const newDevice = new Device(token);

                // Device event listeners
                newDevice.on('ready', () => {
                    console.log('Twilio Device is ready');
                    setCallStatus('Ready to make calls');
                });

                newDevice.on('error', (error) => {
                    console.error('Twilio Device error:', error);
                    setCallStatus(`Error: ${error.message}`);
                });

                newDevice.on('connect', (call) => {
                    console.log('Call connected');
                    setIsConnected(true);
                    setIsConnecting(false);
                    setCurrentCall(call);
                    setCallStatus('Connected');
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

            console.log('Call initiated:', call);

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
                <p>Enter customer phone number with country code (e.g., +1234567890)</p>
            </div>
        </div>
    );
};

export default VoiceCall;