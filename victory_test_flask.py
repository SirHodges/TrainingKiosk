import os
import sys
import unittest
from pathlib import Path

sys.platform = 'linux'

# Import app
sys.path.insert(0, r"C:\Users\sirho\Desktop\Kiosk v2\trainingkiosk")
from server.app import app

class TestUpdateMechanism(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.update_flag = Path('/tmp/trainingkiosk_update')
        # Ensure it doesn't exist initially
        if self.update_flag.exists():
            self.update_flag.unlink()

    def test_update_endpoint(self):
        # We need to make sure the directory /tmp exists on Windows drive so Path.touch() doesn't fail
        if not Path('/tmp').exists():
            Path('/tmp').mkdir(parents=True, exist_ok=True)
            
        response = self.client.post('/api/system/update')
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(self.update_flag.exists())
        print("Update endpoint successfully created flag file.")

if __name__ == '__main__':
    unittest.main()
