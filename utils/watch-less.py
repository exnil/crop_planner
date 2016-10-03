#!/usr/bin/env python3
################################
# Development tool
# Auto-compiles style.less to style.css
#
# Requires lessc and less clean css to be installed:
#	npm install -g less
#	npm install -g less-plugin-clean-css
################################

import os, time
from os import path
from math import floor
from _helper import *


# Main application
class Main:
	style_less = "style.less"
	style_css = "style.css"
	
	def __init__(self):
		clear()
		os.chdir("../")
		header("Watching style.less for changes\nctrl+c to exit")
		print()
		
		while True:
			if not os.path.exists(self.style_less):
				print(self.style_less + " does not exist. Exiting.")
				return
				
			if not os.path.exists(self.style_css):
				self.compile()
			elif path.getmtime(self.style_less) > path.getmtime(self.style_css):
				self.compile()
				
			time.sleep(.2)
				
	def compile(self):
		start = time.time()
		os.system("lessc " + self.style_less + " " + self.style_css + " --clean-css")
		touch(self.style_css, path.getmtime(self.style_less))
		print("Recompiled [" + str(floor((time.time() - start) * 100)) + " ms]")
		print()
	
	
# Run application
if __name__ == "__main__":
	try:
		app = Main()
	except KeyboardInterrupt:
		print("Exiting")