from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait # available since 2.4.0
from selenium.webdriver.support import expected_conditions as EC # available since 2.26.0
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities
from selenium.webdriver.chrome.options import Options
import time
import os
import sys
import tempfile
import subprocess

chromedriver_loc = ""

html_file = os.path.abspath(sys.argv[1])
htmlDir = os.path.dirname(html_file)

# start up a tracing / web server
server_args = [
    "node",
    "lib/server/server.js",
    "--outputFile",
    os.path.join(htmlDir,"mem-trace"),
    htmlDir
]
sp = subprocess.Popen(server_args)
url = "http://localhost:8888/" + os.path.basename(html_file)
scriptDir = os.path.dirname(os.path.realpath(__file__))
chromedriver_loc = os.path.join(scriptDir, "../../node_modules/jalangi/thirdparty/chromedriver")
os.environ["webdriver.chrome.driver"] = chromedriver_loc
chrome_options = Options()
chrome_options.add_argument("--js-flags=--harmony")
driver = webdriver.Chrome(executable_path=chromedriver_loc,chrome_options=chrome_options)

try:
    # open URL with selenium
#    driver.set_window_size(1280,1024)
    driver.get(url)
    WebDriverWait(driver,10).until(lambda driver: driver.execute_script("return document.readyState") == "complete")
    err_msg_code = """
    return (window.__jalangi_errormsgs__ && window.__jalangi_errormsgs__.length > 0) ? window.__jalangi_errormsgs__.join("") : "";
    """
    print driver.execute_script(err_msg_code);
    
    # this flushes the last use
    driver.execute_script("window.J$.analysis.endExecution()")
    # trace = driver.execute_script("return window.J$.stringMemTrace").encode('utf-8')
    # trace_file = open(os.path.join(htmlDir,"mem-trace"), "w")
    # trace_file.write(trace)
    # trace_file.close()
finally:
    driver.quit()
    sp.kill()





