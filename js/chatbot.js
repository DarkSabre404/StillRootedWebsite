// ==========================================
// Still Rooted - Fully Refined Smart Chatbot
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inject Chatbot Widget HTML with explicit wrapper classes
    if (!document.getElementById('ngo-chatbot-container')) {
        const chatbotContainer = document.createElement('div');
        chatbotContainer.id = 'ngo-chatbot-container';

        chatbotContainer.innerHTML = `
            <button id="chatbot-toggle-btn" aria-label="Open Chat">💬 Chat with Rooted Bot</button>
            <div id="chatbot-window" class="chatbot-hidden">
                <div class="chatbot-header">
                    <h3>🌱 Still Rooted Assistant</h3>
                    <button id="chatbot-close-btn" aria-label="Close Chat">&times;</button>
                </div>
                <div class="chatbot-messages" id="chatbot-messages">
                    <div class="bot-message">
                        Hello! I'm your virtual assistant for Still Rooted. Ask me about our workshops, mission, digital literacy sessions, or how to get involved!
                    </div>
                </div>
                <div class="chatbot-input-area">
                    <input type="text" id="chatbot-input" placeholder="Ask about our project..." />
                    <button id="chatbot-send-btn">Send</button>
                </div>
            </div>
        `;
        document.body.appendChild(chatbotContainer);
    }

    // 2. Element Selectors
    const toggleBtn = document.getElementById("chatbot-toggle-btn");
    const closeBtn = document.getElementById("chatbot-close-btn");
    const chatWindow = document.getElementById("chatbot-window");
    const sendBtn = document.getElementById("chatbot-send-btn");
    const inputField = document.getElementById("chatbot-input");
    const messagesArea = document.getElementById("chatbot-messages");

    // Toggle Window Visibility
    if (toggleBtn && chatWindow) {
        toggleBtn.addEventListener("click", () => {
            chatWindow.classList.toggle("chatbot-hidden");
            if (!chatWindow.classList.contains("chatbot-hidden")) {
                inputField.focus();
            }
        });
    }

    if (closeBtn && chatWindow) {
        closeBtn.addEventListener("click", () => {
            chatWindow.classList.add("chatbot-hidden");
        });
    }

    // Event Listeners for Messaging
    if (sendBtn) {
        sendBtn.addEventListener("click", handleUserMessage);
    }
    if (inputField) {
        inputField.addEventListener("keypress", (e) => {
            if (e.key === "Enter") handleUserMessage();
        });
    }

    async function handleUserMessage() {
        if (!inputField || !messagesArea) return;
        const text = inputField.value.trim();
        if (!text) return;

        // Append User Message Bubble
        const userMsg = document.createElement("div");
        userMsg.className = "user-message";
        userMsg.textContent = text;
        messagesArea.appendChild(userMsg);

        inputField.value = "";
        messagesArea.scrollTop = messagesArea.scrollHeight;

        // Show Temporary Loading Bubble
        const loadingId = 'loading-' + Date.now();
        const loadingMsg = document.createElement("div");
        loadingMsg.className = "bot-message";
        loadingMsg.id = loadingId;
        loadingMsg.textContent = "Thinking...";
        messagesArea.appendChild(loadingMsg);
        messagesArea.scrollTop = messagesArea.scrollHeight;

        // Simulate natural processing delay
        setTimeout(() => {
            document.getElementById(loadingId)?.remove();

            const botReply = generateSmartResponse(text);

            const botMsg = document.createElement("div");
            botMsg.className = "bot-message";
            botMsg.textContent = botReply;
            messagesArea.appendChild(botMsg);
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }, 500);
    }

    // 3. Advanced Intent Engine (Fixing the loop and improving accuracy)
    function generateSmartResponse(rawQuery) {
        const query = rawQuery.toLowerCase().trim();

        // Check for NGO / Identity questions specifically
        if (matchesAny(query, ['ngo', 'stands for', 'what is still rooted', 'who are you', 'mission', 'about', 'goal', 'project'])) {
            return "Still Rooted is an intergenerational community school project and initiative! We bridge the gap between senior citizens and youth by fostering digital literacy, sharing oral histories, and hosting community events.";
        }

        // Greetings
        if (matchesAny(query, ['hi', 'hello', 'hey', 'greetings', 'sup', 'good morning', 'good afternoon'])) {
            return "Hello there! Welcome to Still Rooted. What would you like to know about our intergenerational project today?";
        }

        // Digital Literacy & Tech Support
        if (matchesAny(query, ['digital', 'tech', 'phone', 'computer', 'class', 'workshop', 'learn', 'smartphone', 'internet', 'social media'])) {
            return "Our digital literacy workshops connect youth volunteers with seniors to provide one-on-one tech support—helping them navigate smartphones, video call family, and use computers safely.";
        }

        // Storytelling & Oral History
        if (matchesAny(query, ['story', 'history', 'oral', 'heritage', 'memory', 'archive', 'podcast'])) {
            return "Through our storytelling initiative, seniors share their unique life experiences and local history, which our student team preserves through written archives, recorded interviews, and community showcases.";
        }

        // Getting Involved / Volunteering
        if (matchesAny(query, ['join', 'volunteer', 'participate', 'sign up', 'get involved', 'help out'])) {
            return "We're always looking for passionate students and community members! You can join us by signing up through the contact form on our website.";
        }

        // Events & Schedule
        if (matchesAny(query, ['event', 'schedule', 'when', 'time', 'calendar', 'meet', 'location'])) {
            return "Our workshops and community circles take place biweekly. You can check the Events page on our website for specific dates, times, and locations!";
        }

        // Contact Information
        if (matchesAny(query, ['contact', 'email', 'phone', 'reach', 'social', 'instagram'])) {
            return "You can easily reach out to our project team by visiting the Contact page on this website and submitting a message form.";
        }

        // Precise Contextual Fallback
        return "That's a fascinating question about Still Rooted! While I'm running on our smart assistant module, you can discover more details by browsing our Workshops page or reaching out directly through our contact form.";
    }

    function matchesAny(text, keywords) {
        return keywords.some(keyword => text.includes(keyword));
    }
});