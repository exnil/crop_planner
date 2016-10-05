#!/usr/bin/env python3
################################
# Development tool
# Updates config.json using XNBNode to decompile
# game files
#
# Requires:
#	https://github.com/draivin/XNBNode
#	xcompress32.dll - proprietary, not included with XNBNode
################################

import re, os, sys, shutil, json, subprocess, time
from os.path import getmtime
from collections import OrderedDict

# For downloading XNBNode (on user prompt)
# Not used for now
from io import BytesIO
from zipfile import ZipFile
from urllib.request import urlopen

from _helper import *

'''
Notes:
	-StardewValley/Crops.cs
		Info about crop harvesting and quality crop chances
	-StardewValley/Farmer.cs
		Player class
	-StardewValley/Object.cs
		General info about objects (names, prices, sell price, etc.)
	-StardewValley.TerrainFeatures/HoeDirt.cs
		Info about crop planting and speed-gro boosts
'''


# Main application
class Main:
	# Local app config
	s = {}
	settings_path = "data/update-config-settings.json"
	xnbnode_url = "https://github.com/draivin/XNBNode/archive/master.zip"
	xnbnode_repo = "https://github.com/draivin/XNBNode/"
	
	# Path variables
	p = {}
	config_path = "../config.json"
	temp_dir = "data/temp/"
	data_dir = "/Content/Data/"
	
	# Crop data
	objects = {}
	crops = {}
	force = False
	
	def __init__(self):
		# Make sure config for this script exists
		self.init_config()
		clear()
		
		# Existing paths
		self.p["game"] = os.path.abspath(self.s["game_path"] + self.data_dir) + "/"
		self.p["xnb"] = self.s["xnbnode_path"] + "/"
		
		header("Crop Planner - Data Updater")
		
		# Check if forcing update
		self.force = len(sys.argv) > 1
		if self.force: print("Forcing update\n")
		
		if (not self.update_files()) and (not self.force):
			print()
			print("All files up to date. Stopping.")
			return
			
		print()
		self.update_objects()
		print()
		self.update_crops()
		print()
		self.update_config()
		print()
		
		print("Done")
		
	def init_config(self):
		clear()
		header("Crop Planner - Data Updater\nConfig Setup")
		
		# ../config.json must exist
		if not os.path.exists(self.config_path):
			print("Error: Missing ../config.json file. Quitting")
			sys.exit(1)
			
		# Create dirs
		os.makedirs("data", exist_ok=True)
		os.makedirs(self.temp_dir, exist_ok=True)
		os.makedirs(self.temp_dir + "sources", exist_ok=True)
		
		paths_exist = True
		
		# Get / create settings file for this script
		if not os.path.exists(self.settings_path):
			f = open(self.settings_path, "w")
			f.write("{}")
			f.close()
			paths_exist = False
		else:
			with open(self.settings_path, "r") as f:
				try:
					self.s = json.load(f)
				except:
					pass
		
		# Get game path
		if (not "game_path" in self.s) or (not os.path.exists(os.path.abspath(self.s["game_path"] + self.data_dir))):
			paths_exist = False
			while True:
				inp = self.query_path_exists("Stardew Valley installation path")
				
				if not os.path.exists(os.path.abspath(inp + self.data_dir)):
					clear()
					print("Invalid Stardew Valley path, look for the directory with Stardew Valley.exe")
					continue
					
				self.s["game_path"] = inp
				break
		
		# Get XNBNode path
		if (not "xnbnode_path" in self.s) or (not os.path.exists(self.s["xnbnode_path"])):
			paths_exist = False
			
			print("You can download XNBNode from:\n   " + self.xnbnode_repo)
			print()
			print("   Note:")
			print("      XNBNode requires xcompress32.dll, a third")
			print("      party proprietary compression software.")
			print("      This dll is not included with XNBNode.")
			print("\n")
			
			while True:
				inp = self.query_path_exists("XNBNode path")
				
				if not os.path.exists(os.path.abspath(inp + "/main.js")):
					clear()
					print("Invalid XNBNode path, look for the directory with main.js")
					continue
					
				self.s["xnbnode_path"] = inp
				break
				
		# Write settings to file if necessary
		if not paths_exist:
			with open(self.settings_path, "w") as f:
				json.dump(self.s, f, ensure_ascii=False, indent="\t")
	
	def query_path_exists(self, input_msg):
		while True:
			inp = input(input_msg + ":\n>")
			inp = os.path.abspath(inp)
			
			if not os.path.exists(inp):
				clear()
				print("Invalid path, does not exist")
				continue
			
			return inp
			
	# Not used
	def download_xnbnode(self):
		print("Downloading XNBNode to data/temp/XNBNode-master...")
		with urlopen(self.xnbnode_url) as zipresp:
			print("Extracting...")
			with ZipFile(BytesIO(zipresp.read())) as zfile:
				print(zfile.extractall(self.temp_dir))
				
		return os.path.abspath(self.temp_dir + "XNBNode-master")
		
	def update_files(self):
		source_files = [
			["ObjectInformation", "objects"],
			["Crops", "crops"]
		]
		
		# Copy and decompile source files
		i = 0
		is_outdated = False
		for src in source_files:
			src_name = src[0]
			dec_name = src[1]
			source_path = os.path.abspath(self.p["game"] + src_name + ".xnb")
			copy_dest = os.path.abspath(self.temp_dir + "sources/" + src_name + ".xnb")
			
			print(src_name+".xnb:")
			if (not os.path.exists(copy_dest)) or (os.path.getmtime(source_path) > os.path.getmtime(copy_dest)) or self.force:
				is_outdated = True
				shutil.copyfile(source_path, copy_dest)
				print("...copied")
				
				cmd = []
				cmd.append(os.path.abspath(self.p["xnb"] + "node"))
				cmd.append(os.path.abspath(self.p["xnb"] + "main.js"))
				cmd.append("extract")
				cmd.append(os.path.abspath(self.temp_dir + "sources/" + src_name + ".xnb"))
				cmd.append(os.path.abspath(self.temp_dir + "sources/" + dec_name + ".txt"))
				subprocess.check_call(cmd)
				
				print("...decompiled")
			else:
				print("...up to date")
			
			if i == 0: print()
			i += 1
			
		return is_outdated
		
		
	def update_objects(self):
		# Parse objects
		print("Parsing objects:")
		
		src_path = self.temp_dir + "sources/objects.txt"
		json_path = self.temp_dir + "objects.json"
		
		if (not os.path.exists(json_path)) or (getmtime(src_path) > getmtime(json_path)) or self.force:
			objects_file = open(src_path, "r")
			parse = False
			obj_pattern = re.compile(r"^(\d+): \"(.*)\" \#\!String$")
			
			for line in objects_file:
				if line.startswith("content:"):
					parse = True
					continue
				
				if parse:
					line = line.strip()
					matches = obj_pattern.match(line)
					
					if not matches: break
					index = int(matches.group(1))
					data = matches.group(2).split("/")
					
					# Invalid item type
					if (len(data)) < 5: continue
					
					object = {}
					object["index"] = index
					object["name"] = data[0]
					object["price"] = int(data[1])
					object["edible"] = int(data[2])
					
					type = data[3].split(" ")
					object["type"] = type[0]
					if (len(type) > 1):
						object["category"] = type[1]
						
					self.objects[str(index)] = object
			
			
			# Write object data to JSON
			with open(json_path, "w") as json_objects:
				json.dump(self.objects, json_objects, ensure_ascii=False, indent="\t", sort_keys=True)
		
			print("...wrote "+str(len(self.objects))+" objects to file")
		else:
			print("...up to date")
			
			# Read object data from up-to-date JSON
			with open(json_path, "r") as json_objects:
				self.objects = json.load(json_objects)
				
			print("...read "+str(len(self.objects))+" objects from file")
		
	
	def update_crops(self):
		# Parse crops
		
		src_path = self.temp_dir + "sources/crops.txt"
		json_path = self.temp_dir + "crops.json"
		
		print("Parsing crops:")
		if (not os.path.exists(json_path)) or (getmtime(src_path) > getmtime(json_path)) or self.force:
			crops_file = open(src_path, "r")
			parse = False
			crop_pattern = re.compile(r"^(\d+): \"(.*)\" \#\!String$")
			
			for line in crops_file:
				if line.startswith("content:"):
					parse = True
					continue
				
				if parse:
					line = line.strip()
					matches = crop_pattern.match(line)
					
					if not matches: break
					index = int(matches.group(1))
					data = matches.group(2).split("/")
					
					# Invalid item type
					if (len(data)) < 5: continue
					
					# Wild crop
					if int(data[2]) == 23: continue
					
					crop = {}
					crop["index"] = index
					
					h_index = int(data[3])
					harvest = self.objects[str(h_index)]
					id = harvest["name"].lower().replace(" ", "_")
					crop["id"] = id
					crop["name"] = harvest["name"]
					crop["sell"] = harvest["price"]
					crop["buy"] = self.objects[str(index)]["price"] * 2
					crop["stages"] = []
					for days in data[0].split(" "):
						crop["stages"].append(int(days))
					crop["seasons"] = data[1].split(" ")
					regrow = int(data[4])
					if regrow > 0:
						crop["regrow"] = regrow
					
					# Special properties
					if int(data[5]): crop["scythe"] = True
					if data[7] == "true": crop["trellis"] = True
					
					# Harvest data
					harvest_data = {}
					hdata = data[6].split(" ")
					if (len(hdata) > 0) and (hdata[0] == "true"):
						harvest_data["min"] = int(hdata[1])
						harvest_data["max"] = int(hdata[2])
						harvest_data["level_increase"] = int(hdata[3])
						harvest_data["extra_chance"] = float(hdata[4])
					crop["harvest"] = OrderedDict(sorted(harvest_data.items(), key=lambda t: t[0]))
					
					# Special Cases
					if id == "sunflower":
						crop["note"] = "Cheapest at JojaMart"
						crop["buy"] = 125
					elif id == "strawberry":
						crop["buy"] = 100
					elif id == "ancient_fruit":
						crop["buy"] = 700
					elif id == "sweet_gem_berry":
						crop["buy"] = 1000
					elif id == "coffee_bean":
						crop["note"] = "Sold by Travelling Cart for ~2500g"
						
					# Sort crop properties by key into OrderedDict
					ordered_crop = OrderedDict(sorted(crop.items(), key=lambda t: t[0]))
					
					# Add crop by id name
					self.crops[id] = ordered_crop
			
			
			# Write crop data to JSON
			with open(json_path, "w") as json_crops:
				json.dump(self.crops, json_crops, ensure_ascii=False, indent="\t", sort_keys=True)
			
			
			print("...wrote "+str(len(self.crops))+" crops to file")
		else:
			print("...up to date")
			
			# Read crop data from up-to-date JSON
			with open(json_path, "r") as json_crops:
				self.crops = json.load(json_crops, object_pairs_hook=OrderedDict)
				
			print("...read "+str(len(self.crops))+" crops from file")
		
		
	def update_config(self):
		if not len(self.crops):
			print("Error: crop data not found")
			return
		
		print("config.json:")
		
		# Read config file
		config = {}
		with open(self.config_path, "r") as config_file:
			try:
				config = json.load(config_file, object_pairs_hook=OrderedDict)
			except:
				print("...failed to read JSON")
				return
				
		# Alert on differences
		# config["crops"] = old; self.crops = new
		differences = ""
		p = "   ..."
		for crop in config["crops"]:
			if crop["id"] not in self.crops:
				print("...Crop ID '" + crop["id"] + "' discarded")
				continue
				
			check = self.crops[crop["id"]]
			
			if crop["buy"] != check["buy"]:
				differences += p+"buy price is different\n"
				
			if crop["sell"] != check["sell"]:
				differences += p+"sell price is different\n"
				
			if len(crop["stages"]) != len(check["stages"]):
				differences += p+"stages are different\n"
			else:
				s_index = 0
				for s in crop["stages"]:
					if crop["stages"][s_index] != check["stages"][s_index]:
						differences += p+"stages are different\n"
						break
					s_index += 1
						
			if len(differences):
				print("..."+crop["name"]+" differences:\n" + differences)
				differences = ""
			
		# Sort crops alphabetically
		crop_ids = []
		for c_id in self.crops:
			crop_ids.append(c_id)
		crop_ids = sorted(crop_ids, key=str.lower)
		
		# Update config file
		config["crops"] = []
		for c_id in crop_ids:
			config["crops"].append(self.crops[c_id])
		
		with open(self.config_path, "w") as config_file:
			json.dump(config, config_file, ensure_ascii=False, indent="\t")
		
		print("...updated")
		
		
		
# Run application
if __name__ == "__main__":
	try:
		app = Main()
	except KeyboardInterrupt:
		print("\nExiting")