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

    // 3. Advanced Intent Engine
    function generateSmartResponse(rawQuery) {
        const query = rawQuery.toLowerCase().trim();

        // Greetings & Pleasantries
        if (matchesAny(query, ['hi', 'hello', 'hey', 'greetings', 'sup', 'good morning', 'good afternoon'])) {
            return "Hello there! Welcome to Still Rooted. What would you like to know about our intergenerational project today?";
        }
        if (matchesAny(query, ['how are you', 'how do you do', 'how is it going'])) {
            return "I'm doing great, thanks for asking! I'm here and ready to answer any questions you have about Still Rooted.";
        }
        if (matchesAny(query, ['thank', 'thanks', 'appreciate'])) {
            return "You're very welcome! Let me know if there's anything else I can help you with.";
        }

        // NGO Identity / Mission
        if (matchesAny(query, ['ngo', 'stands for', 'what is still rooted', 'who are you', 'mission', 'about', 'goal', 'project', 'what do you do'])) {
            return "Still Rooted is an intergenerational community school project. We bridge the gap between senior citizens and youth by fostering digital literacy, sharing oral histories, and hosting community events.";
        }

        // Target Audience & Age Limits
        if (matchesAny(query, ['how old', 'age limit', 'who can join', 'youth', 'senior', 'teenager', 'elderly', 'students'])) {
            return "Still Rooted is designed for two main groups: seniors (typically 60+) looking to build tech confidence, and youth (high school and college students) eager to volunteer and listen to their stories.";
        }

        // Costs & Fees
        if (matchesAny(query, ['cost', 'fee', 'free', 'pay', 'price', 'charge', 'money'])) {
            return "All of our digital literacy workshops and community circles are 100% free to attend! We want these resources to be as accessible as possible.";
        }

        // Digital Literacy & Tech Support
        if (matchesAny(query, ['digital', 'tech', 'phone', 'computer', 'class', 'workshop', 'learn', 'smartphone', 'internet', 'social media', 'ipad'])) {
            return "Our digital literacy workshops connect youth volunteers with seniors to provide one-on-one tech support. We help with navigating smartphones, video calling family, spotting scams, and using computers safely.";
        }

        // Storytelling & Oral History
        if (matchesAny(query, ['story', 'history', 'oral', 'heritage', 'memory', 'archive', 'podcast', 'record'])) {
            return "Through our storytelling initiative, seniors share their unique life experiences. Our student team preserves these oral histories through written archives, recorded interviews, and community showcases to ensure their legacies live on.";
        }

        // Getting Involved / Volunteering
        if (matchesAny(query, ['join', 'volunteer', 'participate', 'sign up', 'get involved', 'help out', 'register'])) {
            return "We're always looking for passionate students and community members! You can join us by signing up through the contact form on our website. No prior teaching experience is required, just patience and a listening ear.";
        }

        // Events & Logistics
        if (matchesAny(query, ['event', 'schedule', 'when', 'time', 'calendar', 'meet', 'dates'])) {
            return "Our workshops and community circles generally take place biweekly. You can check the Events page on our website for the most up-to-date schedule and session times!";
        }

        // Location & Venues
        if (matchesAny(query, ['where', 'location', 'city', 'based in', 'address', 'venue'])) {
            return "We operate locally, hosting sessions at partner community centers, libraries, and schools. Check our Events page to see the exact venue for our upcoming meetups.";
        }

        // Safety & Privacy
        if (matchesAny(query, ['safe', 'privacy', 'protect', 'data', 'scam', 'security'])) {
            return "Privacy is a top priority. We teach seniors how to spot online scams, and our volunteers are trained to handle digital information safely. All oral history recordings are done with explicit consent.";
        }

        // Language Support
        if (matchesAny(query, ['language', 'spanish', 'bilingual', 'translate', 'speak'])) {
            return "We strive to make our workshops accessible to everyone. Many of our youth volunteers are bilingual, allowing us to offer digital literacy support and record stories in multiple languages.";
        }

        // Partnerships
        if (matchesAny(query, ['partner', 'business', 'corporate', 'collaborate', 'sponsor'])) {
            return "We love collaborating with local businesses, schools, and civic organizations! Drop us a message via the Contact page if your organization wants to team up to support our mission.";
        }

        // Leadership & Founders
        if (matchesAny(query, ['who started', 'founder', 'team', 'who runs', 'leader'])) {
            return "Still Rooted is driven by a passionate, grassroots team of community organizers, educators, and dedicated student volunteers who want to bridge the generational gap.";
        }

        // Contact Information
        if (matchesAny(query, ['contact', 'email', 'phone', 'reach', 'social', 'instagram', 'facebook'])) {
            return "You can easily reach out to our project team by visiting the Contact page on this website and submitting a message form. We try to respond within 24-48 hours!";
        }

        // Fun / Personality
        if (matchesAny(query, ['joke', 'funny', 'laugh'])) {
            return "Why did the smartphone need glasses? It lost all its contacts! ...Okay, maybe I should stick to answering questions about our NGO.";
        }

        // Precise Contextual Fallback
        return "That's a fantastic question! While I'm still learning all the ins and outs of Still Rooted, you can discover more details by browsing our Workshops page or reaching out directly through our contact form.";
    }

    function matchesAny(text, keywords) {
        return keywords.some(keyword => text.includes(keyword));
    }
});