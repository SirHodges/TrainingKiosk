import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options

def run_test():
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    
    driver = webdriver.Chrome(options=chrome_options)
    driver.get("http://127.0.0.1:5000/")
    
    time.sleep(2)
    
    # Switch to Quiz tab
    print("Switching to quiz tab...")
    driver.execute_script("window.dispatchEvent(new CustomEvent('app_gamepad_btn', { detail: { button: 'RB', player: 0 } }));")
    
    time.sleep(1)
    
    # Start quiz
    print("Starting quiz...")
    driver.execute_script("window.dispatchEvent(new CustomEvent('app_gamepad_btn', { detail: { button: 'A', player: 0 } }));")
    
    # Wait for 3..2..1..GO + 1 second
    print("Waiting 5 seconds...")
    time.sleep(5)
    
    # Now simulate RB being pressed during the game!
    # The user says "RB now starts the game", which means they pressed RB.
    # Let's fire RB and see what happens!
    print("Firing RB (skip)...")
    driver.execute_script("window.dispatchEvent(new CustomEvent('app_gamepad_btn', { detail: { button: 'RB', player: 0 } }));")
    
    # Wait to see what happens
    time.sleep(2)
    
    # Try to find debug reason
    try:
        reason = driver.find_element(By.ID, "debug-end-reason").text
        print(f"Game ended! Reason: {reason}")
    except Exception as e:
        print("Game did not end, or reason not found.")
        
    driver.quit()

if __name__ == "__main__":
    run_test()
