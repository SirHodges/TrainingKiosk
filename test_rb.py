from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import sys

print("Setting up Chrome driver...")
options = webdriver.ChromeOptions()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')
try:
    driver = webdriver.Chrome(options=options)
except Exception as e:
    print(f"Failed to start Chrome: {e}")
    sys.exit(1)

try:
    print("Navigating to http://127.0.0.1:5000")
    driver.get("http://127.0.0.1:5000")
    
    print("Waiting for page to load...")
    WebDriverWait(driver, 5).until(
        EC.presence_of_element_located((By.ID, "btn-start-quiz"))
    )
    
    # Check current tab
    tabs = driver.find_elements(By.CSS_SELECTOR, ".app-mode-tab")
    active_tab = next((t for t in tabs if "active" in t.get_attribute("class")), None)
    print(f"Current active tab: {active_tab.text if active_tab else 'None'}")
    
    # Simulate RB button press via CustomEvent because HTML5 Gamepad API is hard to mock
    print("Simulating RB button press via app_gamepad_btn...")
    driver.execute_script("""
        window.dispatchEvent(new CustomEvent('app_gamepad_btn', { detail: { button: 'RB', player: 0 } }));
    """)
    time.sleep(1)
    
    active_tab = next((t for t in driver.find_elements(By.CSS_SELECTOR, ".app-mode-tab") if "active" in t.get_attribute("class")), None)
    print(f"Tab after RB: {active_tab.text if active_tab else 'None'}")
    
    print("Switching back to Quiz...")
    driver.execute_script("""
        window.dispatchEvent(new CustomEvent('app_gamepad_btn', { detail: { button: 'LB', player: 0 } }));
    """)
    time.sleep(1)
    
    print("Simulating START button press via app_gamepad_start_down...")
    driver.execute_script("""
        window.dispatchEvent(new CustomEvent('app_gamepad_start_down'));
    """)
    time.sleep(1)
    
    print("Checking active screen...")
    quiz_screens = ["quiz-start-screen", "quiz-binding-screen", "quiz-countdown-screen", "quiz-game-screen", "quiz-end-screen"]
    for s in quiz_screens:
        el = driver.find_element(By.ID, s)
        if "active" in el.get_attribute("class"):
            print(f"Active screen is: {s}")
            
    print("Waiting 4 seconds for countdown...")
    time.sleep(4)
    
    for s in quiz_screens:
        el = driver.find_element(By.ID, s)
        if "active" in el.get_attribute("class"):
            print(f"Active screen is: {s}")
            
    # Now simulate RB (skip)
    print("Simulating RB button press to SKIP...")
    driver.execute_script("""
        window.dispatchEvent(new CustomEvent('app_gamepad_btn', { detail: { button: 'RB', player: 0 } }));
    """)
    time.sleep(1)
    
    for s in quiz_screens:
        el = driver.find_element(By.ID, s)
        if "active" in el.get_attribute("class"):
            print(f"Active screen after skip is: {s}")
            
    # Now simulate START hold
    print("Simulating START hold (app_gamepad_start_down again)...")
    driver.execute_script("""
        window.dispatchEvent(new CustomEvent('app_gamepad_start_down'));
    """)
    time.sleep(1.5) # Wait for progress to reach 100
    
    for s in quiz_screens:
        el = driver.find_element(By.ID, s)
        if "active" in el.get_attribute("class"):
            print(f"Active screen after hold is: {s}")

finally:
    driver.quit()
