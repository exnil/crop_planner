import os

# Helper functions	
def clear():
	os.system("cls" if os.name == "nt" else "clear")

def touch(fname, mtime=None):
	times = (mtime, mtime) if mtime else None
	with open(fname, "a"):
		os.utime(fname, times)
		
def header(text, center=True, width=80):
	hwidth = width//2
	border = "="*width
	text = text.split("\n")
	print(border)
	for line in text:
		l_space = hwidth - len(line)//2
		print(" "*l_space + line)
	print(border)