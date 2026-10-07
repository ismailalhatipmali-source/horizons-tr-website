"""Check pipeline syntax/order with harmless commands, never the actual host job."""
from pathlib import Path
import hashlib
import json
import shlex
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
SUFFIX = ' && /usr/local/bin/ea-php82 scripts/deploy-native-ui.php /home2/horizonstr/public_html --publish'
BASE_BLOB = '3a8bfe2e0842a3598e6b760b269b94223584cfe9'
class PipelineTests(unittest.TestCase):
    def task(self):
        raw = (ROOT / '.cpanel.yml').read_text()
        prefix, encoded = raw.split('    - ', 1)
        return prefix + '    - ', json.loads(encoded)
    def test_original_chain_is_unchanged(self):
        prefix, task = self.task()
        self.assertTrue(task.endswith(SUFFIX))
        original = task[:-len(SUFFIX)]
        raw = (prefix + json.dumps(original) + '\n').encode()
        self.assertEqual(hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest(), BASE_BLOB)
        subprocess.run(['/bin/bash', '-n', '-c', task], check=True, capture_output=True, timeout=5)
        args = shlex.split(task)
        self.assertEqual(args[:2], ['/bin/bash', '-c'])
        self.assertEqual(args[3:], ['&&', '/usr/local/bin/ea-php82', 'scripts/deploy-native-ui.php', '/home2/horizonstr/public_html', '--publish'])
    def test_prior_failure_prevents_ui_command(self):
        _, task = self.task()
        harmless = '/bin/bash -c "exit 7"' + SUFFIX.replace('/usr/local/bin/ea-php82 scripts/deploy-native-ui.php /home2/horizonstr/public_html --publish', 'printf UI-RAN')
        result = subprocess.run(['/bin/bash', '-c', harmless], capture_output=True, timeout=5)
        self.assertEqual(result.returncode, 7)
        self.assertEqual(result.stdout, b'')
    def test_success_runs_ui_after_first_shell_exits(self):
        harmless = '/bin/bash -c \'trap "printf released-" EXIT; printf old-\'' + SUFFIX.replace('/usr/local/bin/ea-php82 scripts/deploy-native-ui.php /home2/horizonstr/public_html --publish', 'printf UI-RAN')
        result = subprocess.run(['/bin/bash', '-c', harmless], check=True, capture_output=True, timeout=5)
        self.assertEqual(result.stdout, b'old-released-UI-RAN')
if __name__ == '__main__':
    unittest.main(verbosity=2)
