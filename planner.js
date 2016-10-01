// Angular app
angular.module("planner_app", [])
	.controller("planner_controller", planner_controller);
	
function planner_controller($scope){
	var self = this; window.planner = self;
	
	// Core data
	self.config = {};
	self.loaded = false;
	self.data = {plans: {}, harvests: {}, totals: {}};
	self.player = new Player;
	self.update = update;
	
	// Seasons
	self.days = new Array(28*4);
	self.cdate;
	self.seasons = [new Season(0), new Season(1), new Season(2), new Season(3)];
	self.cseason = self.seasons[0];
	self.get_season = get_season;
	self.set_season = set_season;
	
	// Crops
	self.crops_list = []; 			// [id, id, ...]
	self.crops = {}; 				// {id: {data}}
	
	// Planner
	self.fertilizer = {}; 			// [fertilizer, fertilizer, ...]
	self.events = {};				// Birthdays & festivals
	self.newplan;
	self.editplan;
	self.add_plan = add_plan;
	self.add_plan_key = add_plan_key;
	self.edit_plan = edit_plan;
	self.remove_plan = remove_plan;
	self.clear_season = clear_season;
	self.clear_all = clear_all;
	
	// Planner modal
	self.planner_modal = $("#crop_planner");
	self.open_plans = open_plans;
	self.get_date = get_date;
	
	// Crop info modal
	self.cinfo_settings = {season: "spring", sort: "profit", order: false};
	self.open_crop_info = open_crop_info;
	self.cinfo_set_sort = cinfo_set_sort;
	self.planner_valid_crops = planner_valid_crops;
	
	
	init();
	
	
	/********************************
		CORE PLANNER FUNCTIONS
	********************************/
	function init(){
		// Initialize planner data
		for (var i=0; i<self.days.length; i++){
			self.days[i] = i+1;
			self.data.plans[i+1] = [];
		}
		self.data.totals.season = [new Finance, new Finance, new Finance, new Finance];
		
		// Enable bootstrap tooltips
		$("body").tooltip({selector: "[rel=tooltip]"});
		
		// On modal close: save plans and update
		self.planner_modal.on("hide.bs.modal", function(){
			// Only if currently editing
			if (self.editplan){
				self.editplan = null;
				self.update();
				$scope.$apply();
			}
		});
		
		// Load planner config data
		$.ajax({
			url: "config.json",
			dataType: "json",
			success: function(config){
				self.config = config;
				
				// Process crop data
				$.each(self.config.crops, function(i, crop){
					if (!crop.seasons) crop.seasons = [season];
					crop = new Crop(crop);
					self.crops_list.push(crop);
					self.crops[crop.id] = crop;
				});
				
				// Process fertilizer data
				$.each(self.config.fertilizer, function(i, fertilizer){
					fertilizer = new Fertilizer(fertilizer);
					self.config.fertilizer[i] = fertilizer;
					self.fertilizer[fertilizer.id] = fertilizer;
				});
				
				// Process events data
				var s_index = 0;
				$.each(self.config.events, function(season_name, season){
					$.each(season, function(ii, c_event){
						c_event.season = s_index;
						c_event = new CalendarEvent(c_event);
						self.events[c_event.date] = c_event;						
					});
					
					s_index++;
				});
				
				// Load saved plans from browser storage
				var plan_count = load_data();
				self.loaded = true;
				
				// Debug info
				console.log("Loaded "+self.crops_list.length+" crops.");
				console.log("Loaded "+plan_count+" plans.");
				
				// Update plans
				self.newplan = new Plan;
				update();
				$scope.$apply();
			},
			error: function(xhr, status, error){
				if (!xhr.responseText) return;
				console.log("Error: ", status);
				console.log("Reason: ", error);
			}
		});
	}
	
	// Save plan data to localstorage
	function save_data(){
		// Save plan data
		var plan_data = {};
		$.each(self.data.plans, function(date, plans){
			if (!plans.length) return;
			plan_data[date] = [];
			$.each(plans, function(i, plan){
				plan_data[date].push(plan.get_data());
			});
		});
		plan_data = JSON.stringify(plan_data);
		localStorage.setItem("crops", plan_data);
	}
	
	// Load plan data from browser storage
	function load_data(){
		// Load plan data
		var plan_data = localStorage.getItem("crops");
		if (!plan_data) return 0;
		plan_data = JSON.parse(plan_data);
		if (!plan_data) return 0;
		
		var plan_count = 0;
		$.each(plan_data, function(date, plans){
			date = parseInt(date);
			$.each(plans, function(i, plan){
				plan.date = date;
				if (!self.crops[plan.crop]) return; // Invalid crop
				var plan_object = new Plan(plan);
				self.data.plans[date].push(plan_object);
				plan_count++;
			});
		});
		
		return plan_count;
	}
	
	// Update planner info
	function update(){
		// Reset harvests
		self.data.harvests = [];
		
		// Reset financial totals
		self.data.totals = {};
		self.data.totals.day = {};
		self.data.totals.season = [new Finance, new Finance, new Finance, new Finance];
		self.data.totals.year = new Finance;
		
		// Rebuild data
		$.each(self.data.plans, function(date, plans){
			date = parseInt(date);
			
			$.each(plans, function(i, plan){
				var crop = plan.crop;
				var first_harvest = date + plan.get_grow_time();
				var planting_cost = plan.get_cost();
				var season = self.seasons[Math.floor((plan.date-1)/28)];
				var crop_end = crop.end;
				
				if (plan.greenhouse){
					crop_end = self.days.length;
				}
				
				// Update daily costs for planting
				if (!self.data.totals.day[date]) self.data.totals.day[date] = new Finance;
				var d_plant = self.data.totals.day[date];
				d_plant.profit.min -= planting_cost;
				d_plant.profit.max -= planting_cost;
				
				// Update seasonal costs for planting
				var s_plant_total = self.data.totals.season[season.index];
				s_plant_total.profit.min -= planting_cost;
				s_plant_total.profit.max -= planting_cost;
				
				// First harvest of crop occurs after its growth season(s)
				if (first_harvest > crop_end) return;
				
				// Initial harvest
				var harvests = [];
				harvests.push(new Harvest(plan, first_harvest));
				
				// Regrowth harvests
				if (crop.regrow){
					var regrowths = Math.floor((crop_end-first_harvest)/crop.regrow);
					for (var i=1; i<=regrowths; i++){
						var regrow_date = first_harvest + (i*crop.regrow);
						if (regrow_date > crop_end) break;
						harvests.push(new Harvest(plan, regrow_date, true));
					}
				}
				
				// Append harvests to plan object
				plan.harvests = harvests;
				
				// Add up all harvests
				for (var i = 0; i < harvests.length; i++){
					var harvest = harvests[i];
					
					// Update harvests
					if (!self.data.harvests[harvest.date]) self.data.harvests[harvest.date] = [];
					self.data.harvests[harvest.date].push(harvest);
					
					// Update daily revenues from harvests
					if (!self.data.totals.day[harvest.date]) self.data.totals.day[harvest.date] = new Finance;
					var d_harvest = self.data.totals.day[harvest.date];
					d_harvest.profit.min += harvest.revenue.min;
					d_harvest.profit.max += harvest.revenue.max;
					
					// Update seasonal revenues from harvests
					var h_season = Math.floor((harvest.date-1)/28);
					var s_harvest_total = self.data.totals.season[h_season];
					s_harvest_total.profit.min += harvest.revenue.min;
					s_harvest_total.profit.max += harvest.revenue.max;
				}
			});
		});
		
		// Add up annual total
		for (var i = 0; i < self.data.totals.seasons; i++){
			var season = self.data.totals.seasons[i];
			var y_total = self.data.totals.year;
			y_total.profit.min += season.profit.min
			y_total.profit.max += season.profit.max
		}
	}
	
	
	/********************************
		CLASSES
	********************************/
	/****************
		Player class - user-set player configs
	****************/
	function Player(){
		var self = this;
		self.level = 0; // farming level; starts at 0
		self.tiller = false;
		self.agriculturist = false;
		
		self.modal = $("#player_settings");
		
		self.load = load
		self.save = save;
		self.open = open;
		self.toggle_perk = toggle_perk;
		self.quality_chance = quality_chance;
		
		
		init();
		
		
		function init(){
			// On modal close: save player and update planner
			self.modal.on("hide.bs.modal", function(){
				self.save();
				planner.update();
				$scope.$apply();
			});
			
			load();
		}
		
		// Load player config from browser storage
		function load(){
			var pdata = localStorage.getItem("player");
			if (!pdata) return;
			pdata = JSON.parse(localStorage.getItem("player"));
			if (!pdata) return;
			if (pdata.tiller) self.tiller = true;
			if (pdata.agriculturist) self.agriculturist = true;
			if (pdata.level) self.level = pdata.level;
			console.log("Loaded player settings.");
		}
		
		// Save player config to browser storage
		function save(){
			var pdata = {};
			if (self.tiller) pdata.tiller = self.tiller;
			if (self.agriculturist) pdata.agriculturist = self.agriculturist;
			pdata.level = self.level;
			pdata = JSON.stringify(pdata);
			localStorage.setItem("player", pdata);
		}
		
		function open(){
			self.modal.modal();
		}
		
		// Toggle profession perks
		function toggle_perk(key){
			self[key] = !self[key];
			
			// Must have Tiller to have Agriculturist
			if (!self.tiller && key == "tiller"){
				self.agriculturist = false;
			} else if (self.agriculturist && key == "agriculturist"){
				self.tiller = true;
			}
		}
		
		// Get 0-1 chance of crop being 0=regular; 1=silver; 2=gold quality
		// [SOURCE: StardewValley/Crop.cs : function harvest]
		function quality_chance(quality, mult, locale){
			quality = quality || 0;		// Default: check regular quality chance
			mult = mult || 0;			// Multiplier given by type of fertilizer used (0, 1, or 2)
			
			var gold_chance = 0.2 * (self.level / 10) + 0.2 * mult * ((self.level + 2) / 12) + 0.01;
			var silver_chance = Math.min(0.75, gold_chance * 2);
			
			var chance = 0;
			switch (quality){
				case 0:
					chance = Math.max(0, 1 - (gold_chance + silver_chance));
					break;
				case 1:
					chance = Math.min(1, silver_chance);
					break;
				case 2:
					chance = Math.min(1, gold_chance);
					break;
			}
			
			if (locale) return Math.round(chance * 100);
			return chance;
		}
	}
	
	
	/****************
		Season class - representing one of the four seasons
	****************/
	function Season(ind){
		var self = this;
		self.index = ind;
		self.id;
		self.name;
		self.start = 0;
		self.end = 0;
		
		
		init();
		
		
		function init(){
			var seasons = ["spring", "summer", "fall", "winter"];
			self.id = seasons[self.index];
			self.name = self.id.charAt(0).toUpperCase() + self.id.slice(1);
			self.start = (self.index*28)+1;
			self.end = self.start + 27;
		}
	}
	
	// Get season object by id name
	function get_season(id){
		for (var i=0; i<self.seasons.length; i++){
			if (self.seasons[i].id == id) return self.seasons[i];
		}
	}
	
	// Set current season
	function set_season(index){
		self.cseason = self.seasons[index];
		self.newplan.crop_id = null;
	}
	
	
	/****************
		Crop class - represents a crop
	****************/
	function Crop(data){
		var self = this;
		
		// Config properties
		self.id;
		self.name;
		self.sell;
		self.buy;
		self.seasons = [];
		self.stages = [];
		self.regrow;
		self.wild = false;
		
		// Harvest data
		self.harvest = {
			min: 1,
			max: 1,
			level_increase: 1,
			extra_chance: 0
		};
		
		// Custom properties
		self.note = "";
		self.start = 0;			// Start of grow season(s)
		self.end = 0;			// End of grow season(s)
		self.grow = 0;			// total days to grow
		self.profit = 0;		// minimum profit/day (for crops info menu)
		
		// Functions
		self.get_sell = get_sell;
		self.can_grow = can_grow;
		self.get_url = get_url;
		self.get_image = get_image;
		
		
		init();
		
		
		function init(){
			if (!data) return;
			
			// Base properties
			self.id = data.id;
			self.name = data.name;
			self.sell = data.sell;
			self.buy = data.buy;
			self.seasons = data.seasons;
			self.stages = data.stages;
			self.regrow = data.regrow;
			if (data.wild) self.wild = true;
			
			// Harvest data
			if (data.harvest.min) self.harvest.min = data.harvest.min;
			if (data.harvest.max) self.harvest.max = data.harvest.max;
			if (data.harvest.level_increase) self.harvest.level_increase = data.harvest.level_increase;
			if (data.harvest.extra_chance) self.harvest.extra_chance = data.harvest.extra_chance;
			
			// Custom properties
			if (data.note) self.note = data.note;
			self.start = get_season(data.seasons[0]).start;
			self.end = get_season(data.seasons[data.seasons.length-1]).end;
			self.grow = 0;
			for (var i = 0; i < data.stages.length; i++){
				self.grow += data.stages[i];
			}
			
			// Calculate profit per day
			var season_days = (self.end - self.start) + 1;
			var regrowths = self.regrow ? Math.floor(((season_days-1)-self.grow)/self.regrow) : 0;
			
			var plantings = 1;
			if (!regrowths) plantings = Math.floor((season_days-1)/self.grow);
			var growth_days = (plantings * self.grow) + (regrowths * (self.regrow ? self.regrow : 0));
			
			self.profit -= self.buy * plantings;
			self.profit += self.harvest.min * get_sell() * (plantings + regrowths);
			self.profit = Math.round((self.profit/growth_days) * 10) / 10;
		}
		
		// Get crop quality-modified sell price
		// [SOURCE: StardewValley/Object.cs : function sellToStorePrice]
		function get_sell(quality){
			if (!quality) quality = 0;
			return Math.floor(self.sell * (1 + (quality * 0.25)));
		}
		
		// Check if crop can grow on date/season
		function can_grow(date, is_season, in_greenhouse){
			if (in_greenhouse && (date <= planner.days.length)) return true;
			if (is_season){
				var season = date;
				if (typeof season == "string") season = get_season(season);
				return (self.start <= season.start) && (self.end >= season.end);
			} else {
				return (date >= self.start) && (date <= self.end);
			}
		}
		
		// Get url to Stardew Valley wiki
		function get_url(){
			var fragment = self.id.split("_");
			for (var i=0; i<fragment.length; i++){
				fragment[i] = fragment[i].charAt(0).toUpperCase() + fragment[i].slice(1);
			}
			fragment = fragment.join("_");
			return "http://stardewvalleywiki.com/Crops#"+fragment;
		}
		
		// Get thumbnail image
		function get_image(seeds){
			if (seeds && self.wild){
				return "images/seeds/wild_"+self.seasons[0]+".png";
			}
			if (seeds) return "images/seeds/"+self.id+".png";
			return "images/crops/"+self.id+".png";
		}
	}
	
	/****************
		Harvest class - represents crops harvested on a date
	****************/
	function Harvest(plan, date, is_regrowth){
		var self = this;
		self.date = 0;
		self.plan = {};
		self.crop = {};
		self.yield = {min: 0, max: 0};
		self.revenue = {min: 0, max: 0};
		self.cost = 0;
		self.profit = {min: 0, max: 0};
		self.is_regrowth = false;
		
		self.get_cost = get_cost;
		self.get_revenue = get_revenue;
		self.get_profit = get_profit;
		
		
		init();
		
		
		function init(){
			if (!plan || !date) return;
			var crop = plan.crop;
			self.plan = plan;
			self.crop = crop;
			self.date = date;
			
			// Calculate crop yield (+ extra crop drops)
			// [SOURCE: StardewValley/Crop.cs : function harvest]
			self.yield.min = crop.harvest.min * plan.amount;
			self.yield.max = (Math.min(crop.harvest.min + 1, crop.harvest.max + 1 + (planner.player.level / crop.harvest.level_increase))-1) * plan.amount;
			
			// Harvest revenue and costs
			var q_mult = 0;
			if (plan.fertilizer && !plan.fertilizer.is_none()){
				switch (plan.fertilizer.id){
					case "basic_fertilizer":
						q_mult = 1;
						break;
					case "quality_fertilizer":
						q_mult = 2;
						break;
				}
			}
			
			// Calculate min/max revenue based on regular/silver/gold chance
			var regular_chance = planner.player.quality_chance(0, q_mult);
			var silver_chance = planner.player.quality_chance(1, q_mult);
			var gold_chance = planner.player.quality_chance(2, q_mult);
			
			var min_revenue = crop.get_sell(0);
			var max_revenue = (min_revenue*regular_chance) + (crop.get_sell(1)*silver_chance) + (crop.get_sell(2)*gold_chance);
			max_revenue = Math.min(crop.get_sell(2), max_revenue);
			
			// Quality from fertilizer only applies to picked harvest
			// and not to extra dropped yields
			self.revenue.min = Math.floor(min_revenue) * self.yield.min;
			self.revenue.max = Math.floor(max_revenue) + (Math.floor(min_revenue) * Math.max(0, self.yield.max - 1));
			self.cost = crop.buy * plan.amount;
			
			// Tiller profession (ID 1)
			// [SOURCE: StardewValley/Object.cs : function sellToStorePrice]
			if (planner.player.tiller){
				self.revenue.min = Math.floor(self.revenue.min * 1.1);
				self.revenue.max = Math.floor(self.revenue.max * 1.1);
			}
			
			// Regrowth
			if (is_regrowth){
				self.is_regrowth = true;
				self.cost = 0;
			}
			
			// Harvest profit
			self.profit.min = self.revenue.min - self.cost;
			self.profit.max = self.revenue.max - self.cost;
		}
		
		function get_cost(locale){
			if (locale) return self.cost.toLocaleString();
			return self.cost;
		}
		
		function get_revenue(locale, max){
			var value = max ? self.revenue.max : self.revenue.min;
			if (locale) return value.toLocaleString();
			return value;
		}
		
		function get_profit(locale, max){
			var value = max ? self.profit.max : self.profit.min;
			if (locale) return value.toLocaleString();
			return value;
		}
	}
	
	/****************
		Plan class - represents seeds planted on a date
	****************/
	function Plan(data){
		var self = this;
		self.date;
		self.crop_id;
		self.crop = {};
		self.amount = 1;
		self.fertilizer = planner.fertilizer["none"];
		self.greenhouse = false;
		
		self.harvests = [];
		
		self.get_data = get_data;
		self.get_grow_time = get_grow_time;
		self.get_cost = get_cost;
		self.get_revenue = get_revenue;
		self.get_profit = get_profit;
		
		
		init();
		
		
		function init(){
			if (!data) return;
			self.date = data.date;
			self.crop = planner.crops[data.crop];
			self.amount = data.amount;
			self.greenhouse = data.greenhouse ? true : false;
			if (data.fertilizer && planner.fertilizer[data.fertilizer])
				self.fertilizer = planner.fertilizer[data.fertilizer];
		}
		
		// Compile data to be saved as JSON
		function get_data(){
			var data = {};
			data.crop = self.crop.id;
			data.amount = self.amount;
			if (self.greenhouse) data.greenhouse = true;
			if (self.fertilizer && !self.fertilizer.is_none()) data.fertilizer = self.fertilizer.id;
			return data;
		}
		
		function get_grow_time(){
			var stages = $.extend([], self.crop.stages);
			
			if (self.fertilizer.id == "speed_gro" || self.fertilizer.id == "delux_speed_gro" || planner.player.agriculturist){
				// [SOURCE: StardewValley.TerrainFeatures/HoeDirt.cs : function plant]
				var rate = 0;
				switch (self.fertilizer.id){
					case "speed_gro":
						rate = 0.1;
						break;
					case "delux_speed_gro":
						rate = 0.25;
						break;
				}
				
				// Agriculturist profession (ID 5)
				if (planner.player.agriculturist) rate += 0.1;
				
				// Days to remove
				var remove_days = Math.ceil(self.crop.grow * rate);
				
				// For removing more than one day from larger stages of growth
				// when there are still days to remove
				var multi_remove = 0;
				
				// Remove days from stages
				while (remove_days > 0 && multi_remove < 3){
					for (var i = 0; i < stages.length; i++){
						if (i > 0 || stages[i] > 1){
							stages[i] -= 1;
							remove_days--;
						}
						
						if (remove_days <= 0) break;
					}
					
					multi_remove++;
				}
			}
			
			// Add up days of growth
			var days = 0;
			for (var i = 0; i < stages.length; i++){
				days += stages[i];
			}
			
			return days;
		}
		
		function get_cost(locale){
			var amount = self.crop.buy * self.amount;
			if (locale) return amount.toLocaleString();
			return amount;
		}
		
		function get_revenue(locale, max){
			var amount = 0;
			for (var i = 0; i < self.harvests.length; i++){
				amount += max ? self.harvests[i].revenue.max : self.harvests[i].revenue.min;
			}
			if (locale) return amount.toLocaleString();
			return amount;
		}
		
		function get_profit(locale, max){
			var amount = get_revenue(max) - get_cost();
			if (locale) return amount.toLocaleString();
			return amount;
		}
	}
	
	// Add self.newplan to plans list
	function add_plan(date, auto_replant){
		// Validate data
		if (!self.newplan.crop_id) return false;
		
		// Date is out of bounds
		if (!planner.data.plans[date]) return false;
		
		// Check that crop can grow
		var crop = self.crops[self.newplan.crop_id];
		if (!crop.can_grow(date, false, self.newplan.greenhouse)) return false;
		self.newplan.crop = crop;
		
		// Amount to plant
		self.newplan.amount = parseInt(self.newplan.amount || 0);
		if (self.newplan.amount <= 0) return false;
		
		// Add plan
		var plan = new Plan(self.newplan.get_data());
		plan.date = date;
		self.data.plans[date].push(plan);
		
		//int days_to_remove = (int)Math.Ceiling((double)days_to_grow * (double)speed);
		
		// Auto-replanting
		var crop_growth = plan.get_grow_time();
		var next_planting = date + crop_growth;
		var next_grow = next_planting + crop_growth;
		if (!auto_replant || crop.regrow || (auto_replant && !crop.can_grow(next_grow, false, self.newplan.greenhouse))){
			// Reset plan template
			self.newplan = new Plan;
			
			// Update
			update();
			save_data();
		} else if (auto_replant){
			// Auto-replant
			add_plan(next_planting, true);
		}
	}
	
	// Add plan to plans list on enter keypress
	function add_plan_key(date, e){
		if (e.which == 13) add_plan(date);
	}
	
	// Edit plan
	function edit_plan(plan, save){
		if (save){
			self.editplan = null;
			save_data();
			update();
			return;
		} else if (self.editplan){
			// Other edit already open
			save_data();
			update();
		}
		
		self.editplan = plan;
	}
	
	// Remove plan from plans list
	function remove_plan(date, index){
		self.editplan = null;
		self.data.plans[date].splice(index, 1);
		save_data();
		update();
	}
	
	// Remove plans from current season
	function clear_season(){
		for (var date=self.cseason.start; date<=self.cseason.end; date++){
			self.data.plans[date] = [];
		}
		save_data();
		update();
	}
	
	// Remove all plans
	function clear_all(){
		for (var i=0; i<self.days.length; i++){
			self.data.plans[i+1] = [];
		}
		save_data();
		update();
	}
	
	/****************
		Fertilizer class - represents a type of fertilizer
	****************/
	function Fertilizer(data){
		var self = this;
		self.id;
		self.name;
		self.buy = 0;
		self.quality = [0, 0, 0]; // for quality-modifying fertilizers
		self.growth_rate = 0; // for growth-modifying fertilizers
		self.is_none = is_none;
		self.get_image = get_image;
		
		
		init();
		
		
		function init(){
			if (!data) return;
			self.id = data.id;
			self.name = data.name;
			self.buy = data.buy;
			if (data.quality) self.quality = data.quality;
			if (data.growth_rate) self.growth_rate = data.growth_rate;
		}
		
		function is_none(){
			return self.id == "none";
		}
		
		function get_image(){
			if (!self.is_none()) return "images/fertilizer/"+self.id+".png";
		}
	}
	
	/****************
		Finance class - financial details of a day/season/year
	****************/
	function Finance(){
		var self = this;
		self.revenue = {min: 0, max: 0};
		self.cost = 0;
		self.profit = {min: 0, max: 0};
		
		self.get_cost = get_cost;
		self.get_revenue = get_revenue;
		self.get_profit = get_profit;
		
		function get_cost(locale){
			if (locale) return self.cost.toLocaleString();
			return self.cost;
		}
		
		function get_revenue(locale, max){
			var value = max ? self.revenue.max : self.revenue.min;
			if (locale) return value.toLocaleString();
			return value;
		}
		
		function get_profit(locale, max){
			var value = max ? self.profit.max : self.profit.min;
			if (locale) return value.toLocaleString();
			return value;
		}
	}
	
	/****************
		Calendar Event class - event on the calendar
	****************/
	function CalendarEvent(data){
		var self = this;
		self.day;
		self.season;
		
		self.date;
		self.name = "";
		self.festival = false;
		
		self.get_image = get_image;
		self.get_text = get_text;
		
		
		init();
		
		
		function init(){
			if (!data) return;
			self.day = data.day;
			self.season = planner.seasons[data.season];
			
			self.date = (data.season * 28) + self.day;
			self.name = data.name;
			self.festival = data.festival;
		}
		
		function get_image(){
			if (self.festival) return "images/flag.gif";
			return "images/people/" + self.name.toLowerCase() + ".png";
		}
		
		function get_text(){
			if (!self.festival) return self.name + "'s Birthday";
			return self.name;
		}
	}
	
	
	/********************************
		PLANNER MODAL FUNCTIONS
	********************************/
	// Open crop planner modal
	function open_plans(date){
		self.planner_modal.modal();
		self.cdate = date;
	}
	
	// Get formatted date
	function get_date(real_date, format){
		if (!real_date) real_date = self.cdate;
		if (!real_date) return;
		date = real_date % 28 ? real_date % 28 : 28;
		var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
		var nth = "th"; // st nd rd th
		if (date <= 3 || date >= 21){
			switch((date % 100) % 10){
				case 1: nth = "st"; break;
				case 2: nth = "nd"; break;
				case 3: nth = "rd"; break;
			}
		}
		
		var day = days[date%7];
		var season = self.seasons[Math.floor((real_date-1)/28)];
		season = season.name;
		
		var str = format.replace("%l", day)
						.replace("%j", date)
						.replace("%S", nth)
						.replace("%F", season);
		
		return str;
	}
	
	
	/********************************
		CROP INFO FUNCTIONS
	********************************/
	function open_crop_info(){
		$("#crop_info").modal();
		self.cinfo_settings.season = self.cseason.id;
	}
	
	
	function cinfo_set_sort(key){
		if (self.cinfo_settings.sort == key){
			self.cinfo_settings.order = !self.cinfo_settings.order;
		} else {
			self.cinfo_settings.sort = key;
			self.cinfo_settings.order = false;
		}
	}
	
	// Filter crops that can be planted in the planner's drop down list
	function planner_valid_crops(crop){
		return crop.can_grow(self.cseason, true) || self.newplan.greenhouse;
	}
}
