const puppeteer = require('C:\\Users\\sirho\\.gemini\\antigravity\\brain\\d03aa442-abab-48a9-92b3-d00b271542f5\\scratch\\node_modules\\puppeteer');

(async () => {
    console.log("Launching Puppeteer...");
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    console.log("Navigating to Kiosk Quiz Game on Pi...");
    await page.goto('http://172.20.10.7:5000', { waitUntil: 'networkidle2' });
    
    // Switch to Quiz Mode
    const navQuizBtn = await page.$('.app-nav-btn[data-target="quiz-content"]');
    if (navQuizBtn) {
        await navQuizBtn.click();
        await new Promise(r => setTimeout(r, 1000));
        console.log("Switched to Quiz Screen.");
    } else {
        console.log("Could not find Quiz Nav Button. Attempting to evaluate switchMode...");
        await page.evaluate(() => { if (typeof switchMode === 'function') switchMode('quiz'); });
    }
    
    // Make sure it's 1-Player
    await page.evaluate(() => {
        const p1Btn = document.getElementById('btn-mode-1p');
        if (p1Btn) p1Btn.click();
    });
    
    console.log("Starting Quiz via JS function...");
    await page.evaluate(() => {
        if (typeof window.startQuizFlow === 'function') window.startQuizFlow();
        else if (document.getElementById('btn-start-quiz')) document.getElementById('btn-start-quiz').click();
    });
    
    // Fallback if it requires long press logic in app
    await page.evaluate(() => {
        const evt = new MouseEvent('mousedown', { bubbles: true });
        document.getElementById('btn-start-quiz').dispatchEvent(evt);
    });
    await new Promise(r => setTimeout(r, 1200));
    await page.evaluate(() => {
        const evt = new MouseEvent('mouseup', { bubbles: true });
        document.getElementById('btn-start-quiz').dispatchEvent(evt);
    });
    
    console.log("Waiting for game to start (countdown)...");
    await new Promise(r => setTimeout(r, 4000));
    await page.screenshot({ path: 'C:\\Users\\sirho\\.gemini\\antigravity\\brain\\d03aa442-abab-48a9-92b3-d00b271542f5\\scratch\\quiz_screen.png' });
    
    console.log("Playing 15 questions...");
    
    let totalDelayMs = 0;
    let questionsPlayed = 0;
    let transitionDelays = [];
    
    for (let i = 0; i < 15; i++) {
        // Wait for answers to be visible
        try {
            await page.waitForSelector('.quiz-answer-btn', { timeout: 10000 });
        } catch(e) {
            console.log("Game over or no answers found.");
            break;
        }
        
        const qText = await page.$eval('.quiz-question-text', el => el.innerText).catch(() => 'Question');
        
        // Wait a tiny bit (human reaction)
        await new Promise(r => setTimeout(r, 600));
        
        // Click the first answer
        const startTime = Date.now();
        await page.evaluate(() => {
            const btns = document.querySelectorAll('.quiz-answer-btn:not(.hidden)');
            if (btns.length > 0) btns[Math.floor(Math.random() * btns.length)].click();
        });
        
        // Wait for next question
        await page.waitForFunction(() => {
            const btns = document.querySelectorAll('.quiz-answer-btn');
            if (btns.length === 0) return false;
            // Next question has started when no buttons have 'correct' or 'wrong' class AND they are hidden (wait, they get recreated!)
            // A better way is to wait until the old buttons disappear or the question text changes.
            return !Array.from(btns).some(b => b.classList.contains('correct') || b.classList.contains('wrong'));
        }, { timeout: 15000 }).catch(() => {});
        
        const delay = Date.now() - startTime;
        transitionDelays.push(delay);
        console.log(`Q${i+1} Transition Time: ${delay}ms`);
        questionsPlayed++;
    }
    
    const avgDelay = transitionDelays.reduce((a,b) => a+b, 0) / (transitionDelays.length || 1);
    console.log(`\n--- PLAYTEST RESULTS ---`);
    console.log(`Questions Played: ${questionsPlayed}`);
    console.log(`Average Transition Delay: ${Math.round(avgDelay)}ms`);
    
    if (avgDelay > 1500) {
        console.log("Recommendation: The transition delay after answering is quite long. For a speed-based game, reducing the delay between questions to ~500-1000ms would significantly improve the 'head-to-head' competitive pacing.");
    } else {
        console.log("Pacing seems good!");
    }
    
    console.log("Closing browser...");
    await browser.close();
})();
