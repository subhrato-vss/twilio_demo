import './App.css'
import VoiceCall from "./pages/VoiceCall.jsx";

function App() {
    const userId = 'user_123'; // Your authenticated user ID
    return (
        <VoiceCall userId={userId}/>
    )
}

export default App
