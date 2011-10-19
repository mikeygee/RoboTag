(function() {

var RoboTag = this.RoboTag = {};

RoboTag.Robot = function(options) {
	this.status = "initial";

	// my = your robot's stats (position and fuel)
	// enemy = enemy's stats (position and fuel)
	// map contains the size of the arena, fuel and mine locations
	var my = this.my = {}, enemy = this.enemy = {}, map = this.map = {};

	// reset function - clears out all properties, retains move function
	this.reset = function() {
		my = this.my = {}, enemy = this.enemy = {}, map = this.map = {};
	}
	
	// setter function
	this.set = function(options) {
		if(options) {
			for(i in options.my)
				my[i] = options.my[i];
			for(i in options.enemy)
				enemy[i] = options.enemy[i];
			for(i in options.map)
				map[i] = options.map[i];
			if(options.move) {
				try {
					this.move = eval(options.move);
					this.status = "ready";
				}
				catch(err) {
					this.status = err.message;
					return err;
				}
			}
		}
	}

	// set constructor options
	this.set(options);
}

RoboTag.Map = function(options) {
	// data contains map dimensions, fuel tank array, and mine array (info provided to robot)
	// settings contains internal values for constructing the map
	var data = this.data = {};
	var settings = this.settings = {};

	// set defaults
	data.fuelTanks = [];
	data.mines = [];
	data.width = 100;
	data.height = 100;

	settings.startPositions = [{x: 25, y: 25}, {x: 75, y: 75}]; 
	settings.fuelQty = 15;
	settings.mineQty = 30;
	settings.fuelValues = [50,100,150,200,250,300];
	settings.mineValues = [50,100,150,200,250,300];
	settings.fuelDispersion = 10;
	settings.mineDispersion = 5;

	// setter function
	this.set = function(options) {
		if(options) {
			for(i in options.data)
				data[i] = options.data[i];
			for(i in options.settings)
				settings[i] = options.settings[i];
		}
	};


	// subroutine for randomly placing items, with at least a threshold difference (dispersion) between other items and robot start positions, only one of each item can be activated per robot per turn. (may want to change this so mine "walls" are possible).
	var placeItems = function(items, qty, vals, threshold) {
		var x, y, val, dx, dy, distance, again = true, maxTries = 200;
		for(i = 0; i < qty; i++) {
			while(again) {
				again = false;
				x = Math.random() * 100;
				y = Math.random() * 100;
				val = vals[Math.floor(Math.random()*vals.length)];
				for(j = 0, len = items.length; j < len; j++) {
					dx = items[j].x - x;
					dy = items[j].y - y;
					distance = Math.sqrt(dx * dx + dy * dy);
					if(distance <= threshold) {
						again = true;
						break;
					}
				}
				if(!again) {
					for(j = 0, len = settings.startPositions.length; j < len; j++) {
						dx = settings.startPositions[j].x - x;
						dy = settings.startPositions[j].y - y;
						distance = Math.sqrt(dx*dx + dy*dy);
						if(distance <= threshold) {
							again = true;
							break;
						}
					}
				}
				if(--maxTries == 0)
					break;
			}
			items.push({x: x, y: y, value: val});
			again = true;
		}
	}

	// generate a map with randomly scattered fuel tanks and mines, specify quantity for each
	this.generate = function() {
		data.fuelTanks = [];
		data.mines = [];

		// place fuel tanks and mines
		placeItems(data.fuelTanks, settings.fuelQty, settings.fuelValues, settings.fuelDispersion);
		placeItems(data.mines, settings.mineQty, settings.mineValues, settings.mineDispersion);
	};

	this.set(options);

	// generate a random map
	if(options && options.random)
		this.generate(); 
}

RoboTag.Match = function(options) {
	// data contains the 2 competitors, the map, turn count, and the result
	// rules contains the game parameters/options
	var data = this.data = {}, rules = this.rules = {};
	this.status = "initial"; 

	// set defaults
	rules.maxTurns = 1000;
	rules.tagThreshold = 5;
	rules.fuelThreshold = 2;
	rules.mineThreshold = 2;
	rules.maxMove = 3;
	rules.startFuel = 1000;
	rules.maxFuel = 1500;
	rules.ante = 2;

	// set constructor options
	this.set = function(options) {
		for(i in options.data)
			data[i] = options.data[i];
		for(i in options.rules)
			rules[i] = options.rules[i];
	}

	this.set(options);

	var p1 = data.p1, p2 = data.p2, map = data.map; // var shortcuts

	// initialize robots
	var sp = map.settings.startPositions;
	p1.set({my: {x: sp[0].x, y: sp[0].y, fuel: rules.startFuel}, enemy: {x: sp[1].x, y: sp[1].y, fuel: rules.startFuel}, map: clone(map.data)});
	p2.set({my: {x: sp[1].x, y: sp[1].y, fuel: rules.startFuel}, enemy: {x: sp[0].x, y: sp[0].y, fuel: rules.startFuel}, map: clone(map.data)});
	data.turn = 0;
	data.log = [{p1: {x: p1.my.x, y: p1.my.y, f: p1.my.fuel}, p2: {x: p2.my.x, y: p2.my.y, f: p2.my.fuel}}]; 


	// trusted internal copy of the robots and map, update the player data from copy after each turn
	var copy = this.copy = {};
	copy.p1 = clone(p1.my);
	copy.p2 = clone(p2.my);
	copy.map = clone(map.data);

	// check if a tag has occurred
	function tagCheck() {
		var dx = copy.p2.x - copy.p1.x;
		var dy = copy.p2.y - copy.p1.y;
		var distance = Math.sqrt(dx * dx + dy * dy);
		return (distance <= rules.tagThreshold);	
	}
	
	// check if a fuel tank or mine has been hit, if so add/subtract fuel, mark item as hit, and return index(es)
	function itemCheck(robot) {
		var dx, dy, distance, item = {};
		for(var i = 0, len = copy.map.fuelTanks.length; i < len; i++) {
			if(copy.map.fuelTanks[i].hit)
				continue;
			dx = copy.map.fuelTanks[i].x - robot.x;
			dy = copy.map.fuelTanks[i].y - robot.y;
			distance = Math.sqrt(dx * dx + dy * dy);
			if(distance <= rules.fuelThreshold) {
				robot.fuel += copy.map.fuelTanks[i].value;
				if(robot.fuel > rules.maxFuel)
					robot.fuel = rules.maxFuel;
				copy.map.fuelTanks[i].hit = true;			
				item.fuel = i;
				break;
			}
		}
		for(var i = 0, len = copy.map.mines.length; i < len; i++) {
			if(copy.map.mines[i].hit)
				continue;
			dx = copy.map.mines[i].x - robot.x;
			dy = copy.map.mines[i].y - robot.y;
			distance = Math.sqrt(dx*dx + dy*dy);
			if(distance <= rules.mineThreshold) {
				robot.fuel -= copy.map.mines[i].value;
				if(robot.fuel < 0)
					robot.fuel = 0;
				copy.map.mines[i].hit = true;		
				item.mine = i;
				break;
			}
		}
		// if any fuel tank or mine was hit, return the index(es), else return false
		if(item.fuel >= 0 || item.mine >= 0)
			return item;
		else
			return false;
	}

	// subtract fuel and update robot's position
	function update(robot, move) {
		var fuelUsed = (move.dx * move.dx) + (move.dy * move.dy) + rules.ante;
		robot.fuel -= fuelUsed; // subtract fuel
		if(robot.fuel < 0) // if fuel drops below 0 from the move, set fuel to 0 and do not move
			robot.fuel = 0;
		else { // move the robot according to output
			robot.x += move.dx;
			robot.y += move.dy;
			if(robot.x > copy.map.width)
				robot.x = copy.map.width;
			if(robot.y > copy.map.height)
				robot.y = copy.map.height;
			if(robot.x < 0)
				robot.x = 0;
			if(robot.y < 0)
				robot.y = 0;
		}
	}

	// subroutine to write to the game log
	function log(item) {
			data.log[data.turn] = {p1: {x: copy.p1.x, y: copy.p1.y, f: copy.p1.fuel}, p2: {x: copy.p2.x, y: copy.p2.y, f: copy.p2.fuel}}; 
			if(item)
				data.log[data.turn].item = item;
	}

	// execute a match between p1 and p2 on map
	this.run = function() {
		this.status = p1.status = p2.status = "running";
		var m1, m2;
		while(true) {
			try {
				m1 = p1.move();
				if(typeof(m1) == "undefined" || typeof(m1.dx) != "number" || typeof(m1.dy) != "number" || Math.abs(m1.dx) > rules.maxMove || Math.abs(m1.dy) > rules.maxMove)
					throw new Error("Invalid move: Returned object must contain properties dx and dy with numerical value between -" + rules.maxMove + " and " + rules.maxMove);
			}
			catch(err) {
				this.status = p1.status = "error";
				p2.status = "ready";
				data.result = {winner: "none", description: "p1 error", error: err, move: m1};
				return data;
			}
			try {
				m2 = p2.move();
				if(typeof(m2) == "undefined" || typeof(m2.dx) != "number" || typeof(m2.dy) != "number" || Math.abs(m2.dx) > rules.maxMove || Math.abs(m2.dy) > rules.maxMove)
					throw new Error("Invalid move: Returned object must contain properties dx and dy with numerical value between -" + rules.maxMove + " and " + rules.maxMove);
			}
			catch(err) {
				this.status = p2.status = "error";
				p1.status = "ready";
				data.result = {winner: "none", description: "p2 error", error: err, move: m2};
				return data;
			}
			data.turn++;
			update(copy.p1, m1);
			update(copy.p2, m2);
			log();
			if(tagCheck()) {
				this.status = "completed";
				p1.status = p2.status = "ready";
				if(copy.p1.fuel > copy.p2.fuel) {
					data.result = {winner: "p1", description: "tag"};
				}
				else if(copy.p2.fuel > copy.p1.fuel) {
					data.result = {winner: "p2", description: "tag"};
				}
				else {
					data.result = {winner: "none", description: "tie/tag"};
				}
				return data; 
			}
			
			var p1Item = itemCheck(copy.p1);
			var p2Item = itemCheck(copy.p2);
			if(p1Item || p2Item) {
				var fuel = [], mine = [], item = {};
				if(p1Item.fuel >= 0) fuel.push(p1Item.fuel);
				if(p2Item.fuel >= 0) fuel.push(p2Item.fuel);
				if(p1Item.mine >= 0) mine.push(p1Item.mine);
				if(p2Item.mine >= 0) mine.push(p2Item.mine);
				if(fuel.length > 0) item.f = fuel;
				if(mine.length > 0) item.m = mine;
				log(item);
				var untouchedFuel = clone(_.select(copy.map.fuelTanks, function(el) {return !el.hit;}));
				var untouchedMines = clone(_.select(copy.map.mines, function(el) {return !el.hit;}));
				p1.set({map: {fuelTanks: untouchedFuel, mines: untouchedMines}});
				p2.set({map: {fuelTanks: untouchedFuel, mines: untouchedMines}});
			}
			p1.set({my: copy.p1, enemy: copy.p2});
			p2.set({my: copy.p2, enemy: copy.p1});
			var empty = (copy.p1.fuel == 0 && copy.p2.fuel == 0);
			var timeExpired = (data.turn == data.maxTurns);
			if(empty) {
				this.status = "completed";
				p1.status = p2.status = "ready";
				data.result = {winner: "none", description: "tie/0fuel"};
				return data; 
			}
			if(timeExpired) {
				this.status = "completed";
				p1.status = p2.status = "ready";
				data.result = {winner: "none", description: "tie/timeExpired"};
				return data; 
			}		
		}
	}
	
	this.reset = function(options) {
		var sp = map.settings.startPositions;
		if(options && options.swap)
			sp.reverse();
		var p1name = p1.my.name, p2name = p2.my.name;
		p1.reset();
		p2.reset();
		p1.set({my: {id: 1, name: p1name, x: sp[0].x, y: sp[0].y, fuel: rules.startFuel}, enemy: {x: sp[1].x, y: sp[1].y, fuel: rules.startFuel}, map: clone(map.data)});
		p2.set({my: {id: 2, name: p2name, x: sp[1].x, y: sp[1].y, fuel: rules.startFuel}, enemy: {x: sp[0].x, y: sp[0].y, fuel: rules.startFuel}, map: clone(map.data)});
		copy.p1 = clone(p1.my);
		copy.p2 = clone(p2.my);
		copy.map = clone(map.data);
		data.turn = 0;
		data.log = [{p1: {x: p1.my.x, y: p1.my.y, f: p1.my.fuel}, p2: {x: p2.my.x, y: p2.my.y, f: p2.my.fuel}}]; 
		this.status = "initial";
	}

}

RoboTag.Player = function(match) {
	
	var log = this.log = match.log || {};
	var map = this.map = match.map.data || {};
	var result = this.result = match.result || {};
	var p1 = this.p1 = match.p1 || {};
	var p2 = this.p2 = match.p2 || {};
	this.status = "initial";

	// variables and images used for drawing/animating the match
	this.cursor = 0;
	this.intervalId = 0;
	var intervalTime = 50;
	var multiplier = 5;
	var offset = {x: 55, y: 25};
	var p1Img = document.getElementById("p1-img40");
	var p2Img = document.getElementById("p2-img40");
	var fuelImg = document.getElementById("fuel-img");
	var mineImg = document.getElementById("mine-img");
	var robotSize = 40;
	var itemSize = 20;
	var fuelBarWidth = 30;
	var maxFuel = 1500;
	
	// translate a logical coordinate to the scaled canvas coordinate
	var mapToCanvas = function(point) {
				return {x: offset.x + (point.x * multiplier), y: (map.height - point.y) * multiplier + offset.y};
	}

	// add canvas mapped location property to fuel and mine arrays
	for(var i = 0, l = map.fuelTanks.length; i < l; i++) {
		map.fuelTanks[i].mappedLocation = mapToCanvas({x: map.fuelTanks[i].x, y: map.fuelTanks[i].y});
	}
	for(var i = 0, l = map.mines.length; i < l; i++) {
		map.mines[i].mappedLocation = mapToCanvas({x: map.mines[i].x, y: map.mines[i].y});
	}

	// draw the frame of the match referenced by the cursor
	this.drawFrame = function() {
		if(this.cursor >= log.length) {
			this.cursor = log.length - 1;
			this.pause();
			this.status = "end";
			return false;
		}
		var current = log[this.cursor];
		var p1Map = mapToCanvas(current.p1);
		var p2Map = mapToCanvas(current.p2);
		
		var ctx = document.getElementById("canvas").getContext('2d');
		ctx.clearRect(0,0,610,550);
		ctx.strokeRect(40, 10, 530, 539);
		ctx.font = "bold 10px Arial";
		ctx.textAlign = "center";

		// hide or show items depending on cursor position
		var df = map.fuelTanks;
		var dm = map.mines;
		for(i = 0; i <= this.cursor; i++) {
			if(log[i].item) {
				if(log[i].item.f) {
					for(j = 0; j < log[i].item.f.length; j++)
						df[log[i].item.f[j]].hide = true;
				}
				if(log[i].item.m) {
					for(j = 0; j < log[i].item.m.length; j++)
						dm[log[i].item.m[j]].hide = true;
				}
			}
		}
		for(i = this.cursor + 1, len = log.length; i < len; i++) {
			if(log[i].item) {
				if(log[i].item.f) {
					for(j = 0; j < log[i].item.f.length; j++)
						df[log[i].item.f[j]].hide = false;
				}
				if(log[i].item.m) {
					for(j = 0; j < log[i].item.m.length; j++)
						dm[log[i].item.m[j]].hide = false;
				}
			}
		}

		// draw fuel tanks
		for(i = 0, len = df.length; i < len; i++) {
			if(!df[i].hide) {
				ctx.drawImage(fuelImg, df[i].mappedLocation.x - 0.5*itemSize, df[i].mappedLocation.y - 0.5*itemSize, itemSize, itemSize); 
				if($("#item-values:checked").length == 1)
					ctx.fillText("+" + df[i].value, df[i].mappedLocation.x-2, df[i].mappedLocation.y + itemSize);
			}	
		}
		// draw mines
		for(i = 0, len = dm.length; i < len; i++) {
			if(!dm[i].hide) {
				ctx.drawImage(mineImg, dm[i].mappedLocation.x - 0.5*itemSize, dm[i].mappedLocation.y - 0.5*itemSize, itemSize, itemSize); 
				if($("#item-values:checked").length == 1)
					ctx.fillText("-" + dm[i].value, dm[i].mappedLocation.x-2, dm[i].mappedLocation.y + itemSize);
			}
		}

		// draw robots with current position, robot with more fuel appears on top
		if($("#path:checked").length == 1) {
			ctx.beginPath();
			ctx.moveTo(p1Map.x, p1Map.y);
			for(i = this.cursor - 1; i >= 0; i--)
				ctx.lineTo(mapToCanvas(log[i].p1).x, mapToCanvas(log[i].p1).y);
			ctx.strokeStyle = "#FFFFFF";
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(p2Map.x, p2Map.y);
			for(i = this.cursor - 1; i >= 0; i--)
				ctx.lineTo(mapToCanvas(log[i].p2).x, mapToCanvas(log[i].p2).y);
			ctx.strokeStyle = "#000000";
			ctx.stroke();
		}
		if($("#coords:checked").length == 1) {
			ctx.fillText("(" + current.p1.x.toFixed(1) + "," + current.p1.y.toFixed(1) + ")", p1Map.x, p1Map.y + 0.8*robotSize);
			ctx.fillText("(" + current.p2.x.toFixed(1) + "," + current.p2.y.toFixed(1) + ")", p2Map.x, p2Map.y + 0.8*robotSize);
		}
		if(current.p1.f > current.p2.f) {
			ctx.drawImage(p2Img, p2Map.x - 0.5*robotSize, p2Map.y - 0.5*robotSize, robotSize, robotSize);	
			ctx.drawImage(p1Img, p1Map.x - 0.5*robotSize, p1Map.y - 0.5*robotSize, robotSize, robotSize);	
		}
		else {
			ctx.drawImage(p1Img, p1Map.x - 0.5*robotSize, p1Map.y - 0.5*robotSize, robotSize, robotSize);	
			ctx.drawImage(p2Img, p2Map.x - 0.5*robotSize, p2Map.y - 0.5*robotSize, robotSize, robotSize);	
		}
		// draw fuel bars
		if($("#fuel-bars:checked").length == 1) {
			var scaledHeight = current.p1.f * (530 / maxFuel);
			ctx.fillStyle = "#FFFFFF";
			ctx.fillRect(0, ctx.canvas.height - scaledHeight, fuelBarWidth, scaledHeight);
			ctx.fillStyle = "#000000";
			ctx.fillText(current.p1.f.toFixed(1), 0.5*fuelBarWidth, ctx.canvas.height - scaledHeight - 5);
			scaledHeight = current.p2.f * (530 / maxFuel);
			ctx.fillRect(ctx.canvas.width - fuelBarWidth, ctx.canvas.height - scaledHeight, fuelBarWidth, scaledHeight);
			ctx.fillText(current.p2.f.toFixed(1), ctx.canvas.width - 0.5*fuelBarWidth, ctx.canvas.height - scaledHeight - 5);
		}
		// draw updates to header
		$(".display .p1-text").html(current.p1.f.toFixed(0));
		$(".display .p2-text").html(current.p2.f.toFixed(0));
		$(".names-time .time").html(this.cursor);
		$("#seeker").slider("value", this.cursor);
		if(this.cursor == log.length - 1) {
			$(".game-status .p1, .game-status .p2, .game-status .message").empty();
			if(result.winner == "p1") {
				$("#check").clone().appendTo(".game-status .p1");
				$(".game-status .message").html(p1.my.name + " wins").addClass("p1-text").css("visibility","visible");
				$("#x").clone().appendTo(".game-status .p2");
			}
			else if(result.winner == "p2") {
				$("#check").clone().appendTo(".game-status .p2");
				$(".game-status .message").html(p2.my.name + " wins").addClass("p2-text").css("visibility","visible");
				$("#x").clone().appendTo(".game-status .p1");
			}
			else {
				$("#x").clone().appendTo(".game-status .p2");
				$(".game-status .message").html("Tie").addClass("neutral-text").css("visibility","visible");
				$("#x").clone().appendTo(".game-status .p1");
			}	
		}	
		else if($(".game-status .message").html() != "") {
			$(".game-status .p1, .game-status .p2, .game-status .message").empty();
			$(".game-status .message").removeClass("neutral-text p1-text p2-text").css("visibility","hidden");
		}

		return true;
	}
	
	this.play = function() {
		clearInterval(this.intervalId);
		this.status = "play";
		$("#play").button("option","icons",{primary: 'ui-icon-pause'});
		this.intervalId = setInterval(_.bind(function() {this.drawFrame(); this.cursor++;}, this), intervalTime);
	}

	this.pause = function() {
		clearInterval(this.intervalId);
		this.status = "pause"
		$("#play").button("option","icons",{primary: 'ui-icon-play'});
	}
	
	this.stepForward = function() {
		if(this.status != "pause")
			this.pause();
		this.cursor++;
		this.drawFrame();
	}
	
	this.stepBack = function() {
		if(this.status != "pause")
			this.pause();
		this.cursor--;
		this.drawFrame();
	}

	this.replay = function() {
		clearInterval(this.intervalId);
		this.cursor = 0;
		this.play();
	}
}
	
// deep clone function from stack overflow: http://stackoverflow.com/questions/122102/what-is-the-most-efficient-way-to-clone-a-javascript-object
var clone = function(obj) {
	if(obj == null || typeof(obj) != 'object')
		return obj;
	var temp = new obj.constructor();
	for(var key in obj)
		temp[key] = clone(obj[key]);
	return temp;
}

RoboTag.demo = function() {
	
	// embedded ace text editors
	var editor1 = RoboTag.editor1 = ace.edit("editor1");	
	var JavaScriptMode = require("ace/mode/javascript").Mode;
	editor1.getSession().setMode(new JavaScriptMode());
	editor1.getSession().on("change", function() {
		if($(".p1 .save").attr("disabled"))
			$(".p1 .save").removeAttr("disabled");
			$(".code-header .p1 .message").empty().css("visibility","hidden");
	});

	var editor2 = RoboTag.editor2 = ace.edit("editor2");
	editor2.getSession().setMode(new JavaScriptMode());
	editor2.setTheme("ace/theme/twilight");
	editor2.getSession().on("change", function() {
		if($(".p2 .save").attr("disabled"))
			$(".p2 .save").removeAttr("disabled");
			$(".code-header .p2 .message").empty().css("visibility","hidden");
	});

	var customFn1 = "// write your function\n// confused? try a sample from the drop down\nfunction move(my, enemy, map) {\n\t\n}";
	var customFn2 = customFn1;
	editor1.getSession().setValue(customFn1);
	editor2.getSession().setValue(customFn2);
	//editor1.env.editor.renderer.setShowGutter(false);
	//editor2.env.editor.renderer.setShowGutter(false);

	var ctx = document.getElementById("canvas").getContext('2d');
	ctx.strokeRect(40, 10, 530, 539);

	var map = RoboTag.map = new RoboTag.Map();
	var p1 = RoboTag.p1 = new RoboTag.Robot({my: {id: 1}});
	var p2 = RoboTag.p2 = new RoboTag.Robot({my: {id: 2}});
	var match;
	var player;

	// set up control buttons
	$("#play").button({icons: {primary: "ui-icon-play"}, text: false, disabled: true})
		.click({player: player}, function() {
			if(player.status == "play")
				player.pause();
			else if(player.status == "end")
				player.replay();
			else
				player.play();
			});
	
	$("#seeker").slider({value: 0, disabled: true,
		start: function(event, ui) {
			if(player.status == "play")
				clearInterval(player.intervalId);
		},
		slide: function(event, ui) {
			player.cursor = ui.value;
			player.drawFrame();
		},
		stop: function(event, ui) {
			player.cursor = ui.value;
			player.drawFrame();
			if(player.status == "play")
				player.play();
		}
	});	
		
	$("#swap").button({icons: {primary: "ui-icon-shuffle"}, disabled: true})
		.click({player: player}, function() {
			clearInterval(player.intervalId);
			runMatch({swap: true});
		});

	$("#rematch").button({icons: {primary: "ui-icon-arrowrefresh-1-e"}, disabled: true})
		.click({player: player}, function() {
			clearInterval(player.intervalId);
			runMatch();
		});
	
	$("#series").button({disabled: true})
		.click({player: player}, function() {
			clearInterval(player.intervalId);
			runSeries(5);
		});

	$("#display-options input").attr("disabled","disabled");


	// subroutine to clear the canvas, disable buttons, and reset header
	function resetDisplay() {
		ctx.clearRect(0,0,610,550);
		ctx.strokeRect(40, 10, 530, 539);
		$("#controls button").button("disable");
		$("#seeker").slider("disable");
		$("#display-options input").attr("disabled","disabled");
		$(".game-status .p1, .game-status .p2, .game-status .message").empty();
		$(".game-status .message").removeClass("neutral-text p1-text p2-text").css("visibility","hidden");
		$(".display .p1-text, .display .p2-text").html(1000);
		$(".names-time .time").html(0);
		$("#canvas-alt").remove();
	}

	// subroutine for initializing and executing a match
	var runMatch = function(options) {
		if(options && options.swap && match)
			match.reset({swap: true});
		else {
			var fn1 = editor1.getSession().getValue(), fn2 = editor2.getSession().getValue();
			map = new RoboTag.Map({random: true, settings: {fuelQty: parseInt($("#fuel-qty").val()), mineQty: parseInt($("#mine-qty").val())}});
			p1 = new RoboTag.Robot({my: {id: 1, name: $(".code-header .p1-text").html(), x: map.settings.startPositions[0].x, y: map.settings.startPositions[0].y}, enemy: {x: map.settings.startPositions[1].x, y: map.settings.startPositions[1].y, fuel: 1000}, map: clone(map.data), move: "(function() " + fn1.substr(fn1.indexOf("{")) + ")"});
			p2 = new RoboTag.Robot({my: {id: 2, name: $(".code-header .p2-text").html(), x: map.settings.startPositions[1].x, y: map.settings.startPositions[1].y}, enemy: {x: map.settings.startPositions[0].x, y: map.settings.startPositions[0].y}, map: clone(map.data), move: "(function() " + fn2.substr(fn2.indexOf("{")) + ")"});
			match = RoboTag.match = new RoboTag.Match({data: {p1: p1, p2: p2, map: map}});
		}
		var matchData = RoboTag.matchData = match.run();
		if(match.status == "error") {
			//$(".ui-dialog").remove();
			$(".modal").remove();
			var p = (p1.status == "error") ? p1 : p2;
			var errorDetails = RoboTag.errorDetails = $("#rt-error").tmpl({message: matchData.result.error.message, p: p, fuelTanks: _.map(p.map.fuelTanks, function(el) {return {x: el.x.toFixed(2), y: el.y.toFixed(2), value: el.value};}), mines: _.map(p.map.mines, function(el) {return {x: el.x.toFixed(2), y: el.y.toFixed(2), value: el.value};})}).modal({backdrop: true});//.dialog({autoOpen: false, width: 480});
			$(((p1.status == "error") ? ".code-header .p1" : ".code-header .p2") + " .message").empty()
				.html("RUN TIME ERROR. Click for details.")
				.removeClass("success")
				.addClass("error")
				.css({visibility: "visible", cursor: "pointer"})
				.click(function() {
					errorDetails.modal('show');//dialog("open");
				});
			resetDisplay();
		}
		else if(!options || !options.silent) {
			player = RoboTag.player = new RoboTag.Player(matchData);
			$("#controls button").button("enable");
			$("#play").button("option","icons",{primary: 'ui-icon-play'});
			$("#display-options input").removeAttr("disabled");
			$("#seeker").slider("option", { min: 0, max: matchData.log.length - 1, disabled: false });
			player.drawFrame();
			$(".game-status .message").html("Press Play below to start").addClass("neutral-text").css("visibility","visible");
			$(".game-status .p1, .game-status .p2").html("&nbsp;");
			$("html,body").animate({scrollTop: $("#step2").offset().top - 45}, 500);
			$("#canvas-alt").remove();
		}
		return matchData;
	}
	
	// subroutine to run multiple matches and view summarized stats
	function runSeries(num) {
		$("#canvas-alt").remove();
		var series = RoboTag.series = [];
		var m;
		for(var i = 0; i < num; i++) {
			m = runMatch({silent: true});
			if(m.result.error)
				break;
			series.push(clone(m));
			m = runMatch({silent: true, swap: true});
			if(m.result.error)
				break;
			series.push(clone(m));
		}
		if(m && m.result.error) {
			$("#series-error").tmpl({message: m.result.error.message}).appendTo("#canvas-div").fadeIn(1000);
			$("#canvas-alt .error").css({cursor: "pointer"}).click(function() { RoboTag.errorDetails.dialog("open"); });
		}
		// calculate summarized stats for the series
		else {
			var p1stats = RoboTag.p1stats = {wins: 0, losses: 0, ties: 0, margin: 0, tanks: 0, mines: 0, distance: 0, fuel: 0};
			var p2stats = RoboTag.p2stats = {wins: 0, losses: 0, ties: 0, margin: 0, tanks: 0, mines: 0, distance: 0, fuel: 0};
			var turns = 0;
			for(var i = 0, len = series.length; i < len; i++) {
				if(series[i].result.winner == "p1") {
					p1stats.wins++;
					p2stats.losses++;
				}
				else if(series[i].result.winner == "p2") {
					p2stats.wins++;
					p1stats.losses++;
				}
				else {
					p1stats.ties++;
					p2stats.ties++;
				}
				var lastMove = series[i].log[series[i].log.length - 1];
				p1stats.margin += (lastMove.p1.f - lastMove.p2.f);
				p2stats.margin += (lastMove.p2.f - lastMove.p1.f);
				turns += series[i].turn;
				for(var j = 0, l = series[i].log.length - 1; j < l; j++) {
					var current = series[i].log[j];
					var next = series[i].log[j+1];
					var dx = current.p1.x - next.p1.x;
					var dy = current.p1.y - next.p1.y;
					p1stats.distance += Math.sqrt((dx * dx) + (dy * dy));	
					p1stats.fuel += ((dx * dx) + (dy * dy) + 2);
					dx = current.p2.x - next.p2.x;
					dy = current.p2.y - next.p2.y;
					p2stats.distance += Math.sqrt((dx * dx) + (dy * dy));	
					p2stats.fuel += ((dx * dx) + (dy * dy) + 2);
					if(next.item) {
						if(next.item.f && next.p1.f > current.p1.f)
							p1stats.tanks++;
						if(next.item.f && next.p2.f > current.p2.f)
							p2stats.tanks++;
						if(next.item.m && (current.p1.f - next.p1.f) > 20)
							p1stats.mines++;
						if(next.item.m && (current.p2.f - next.p2.f) > 20)
							p2stats.mines++;
					}
				}
			}
			p1stats.avgMargin = (p1stats.margin / series.length).toFixed(1);
			p1stats.avgTanks = (p1stats.tanks / series.length).toFixed(1);
			p1stats.avgMines = (p1stats.mines / series.length).toFixed(1);
			p1stats.avgDistance = (p1stats.distance / turns).toFixed(1);
			p1stats.avgFuel = (p1stats.fuel / turns).toFixed(1);
			p2stats.avgMargin = (p2stats.margin / series.length).toFixed(1);
			p2stats.avgTanks = (p2stats.tanks / series.length).toFixed(1);
			p2stats.avgMines = (p2stats.mines / series.length).toFixed(1);
			p2stats.avgDistance = (p2stats.distance / turns).toFixed(1);
			p2stats.avgFuel = (p2stats.fuel / turns).toFixed(1);
			var avgTurns = (turns / series.length).toFixed(1);

			// display the stats over the canvas
			ctx.clearRect(0,0,610,550);
			ctx.strokeRect(40, 10, 530, 539);
			$(".game-status .p1, .game-status .p2, .game-status .message").empty();
			$(".game-status .message").removeClass("neutral-text p1-text p2-text").css("visibility","hidden");
			if(p1stats.wins > p2stats.wins) {
				$("#check").clone().appendTo(".game-status .p1");
				$(".game-status .message").html(p1.my.name + " wins").addClass("p1-text").css("visibility","visible");
				$("#x").clone().appendTo(".game-status .p2");
			}
			else if(p2stats.wins > p1stats.wins) {
				$("#check").clone().appendTo(".game-status .p2");
				$(".game-status .message").html(p2.my.name + " wins").addClass("p2-text").css("visibility","visible");
				$("#x").clone().appendTo(".game-status .p1");
			}
			else {
				$("#x").clone().appendTo(".game-status .p2");
				$(".game-status .message").html("Tie").addClass("neutral-text").css("visibility","visible");
				$("#x").clone().appendTo(".game-status .p1");
			}	
			$("#play").button("disable");
			$("#seeker").slider("disable");
			$("#series-summary").tmpl({p1: p1stats, p2: p2stats, turns: turns, avgTurns: avgTurns, n: series.length}).appendTo("#canvas-div");
			$("#canvas-alt").fadeIn(1000);
		}
	}

	// set a robot's move function, check for syntax errors
	function save(robot, fn) {
		var divId = ".p" + robot.my.id;
		// Note to self: Chrome/Safari require anonymous functions to be in parentheses when using eval
		robot.set({move: "(function() " + fn.substr(fn.indexOf("{")) + ")"});
		if(robot.status == "ready") {
			$(divId + " .message")
				.empty().html("Ready")
				.removeClass("error")
				.addClass("success")
				.css({visibility: "visible", cursor: "default"})
				.unbind("click");
			$(divId + " .save").attr("disabled","disabled");
		}
		else {
			$(divId + " .message").empty()
				.html(robot.status)
				.removeClass("success")
				.addClass("error")
				.css({visibility: "visible", cursor: "default"})
				.unbind("click");
			resetDisplay();
		}
		if(p1.status == "ready" && p2.status == "ready") {
			runMatch();
		}
		else {
			resetDisplay();
		}
	}

	var sampleBots = {
		"Lazy Bot": "// never move\nfunction move(my, enemy, map) {\n\treturn {dx: 0, dy: 0};\n}",
		"Random Bot": "// move randomly within the allowed limits\nfunction move(my, enemy, map) {\n\treturn {dx: Math.random()*6 - 3, dy: Math.random()*6 - 3};\n}",
		"Bouncy Bot": "// move at constant speed and bounce off walls\n// example of storing persistent variables\nfunction move(my, enemy, map) {\n\tif(typeof(my.dx) == \"undefined\") {\n\t\tmy.dx = 1;\n\t\tmy.dy = -2;\n\t}\n\tif(my.x == 100 || my.x == 0)\n\t\tmy.dx *= -1;\n\tif(my.y == 100 || my.y == 0)\n\t\tmy.dy *= -1;\n\treturn {dx: my.dx, dy: my.dy};\n}",
		"Hungry Bot": "// go to closest fuel tank\n// when all tanks are gone, go to enemy\nfunction move(my, enemy, map) {\n\tvar closestFuelTank = false;\n\tvar minDistance=1000;\n\tvar dx, dy, d, myMove = {};\n\tfor(i=0, len=map.fuelTanks.length; i < len; i++) {\n\t\tdx = my.x - map.fuelTanks[i].x;\n\t\tdy = my.y - map.fuelTanks[i].y;\n\t\td = Math.sqrt(dx*dx + dy*dy);\n\t\tif(d < minDistance) {\n\t\t\tminDistance = d;\n\t\t\tclosestFuelTank = map.fuelTanks[i];\n\t\t}\n\t}\n\n\tif(closestFuelTank) {\n\t\tdx = closestFuelTank.x - my.x;\n\t\tdy = closestFuelTank.y - my.y;\n\t\tif(Math.abs(dx) > Math.abs(dy)) {\n\t\t\tmyMove.dx = 2*(Math.abs(dx)/dx);\n\t\t\tmyMove.dy = (2/(Math.abs(dx)))*dy;\n\t\t}\n\t\telse {\n\t\t\tmyMove.dy = 2*(Math.abs(dy)/dy);\n\t\t\tmyMove.dx = (2/(Math.abs(dy)))*dx;\n\t\t}\n\t}\n\telse {\n\t\tdx = enemy.x - my.x;\n\t\tdy = enemy.y - my.y;\n\t\tif(Math.abs(dx) > Math.abs(dy)) {\n\t\t\tmyMove.dx = 3*(Math.abs(dx)/dx);\n\t\t\tmyMove.dy = (3/(Math.abs(dx)))*dy;\n\t\t}\n\t\telse {\n\t\t\tmyMove.dy = 3*(Math.abs(dy)/dy);\n\t\t\tmyMove.dx = (3/(Math.abs(dy)))*dx;\n\t\t}\n\t}\n\n\treturn myMove;\n}"
	};


	$(".p1 select").change(function() {
		resetDisplay();
		var name = $(".p1 option:selected").html();
		$(".p1 .p1-text, .names-time .p1-text").html(name);
		if(name == "Player 1") {
			p1.status = "initial";
			editor1.getSession().setValue(customFn1);
			editor1.setReadOnly(false);
			$(".p1 .save").removeAttr("disabled");
			$(".p1 .message").empty().css("visibility","hidden");
		}
		else {
			var fn = sampleBots[name];
			editor1.getSession().setValue(fn);
			editor1.setReadOnly(true);
			save(p1, fn);
		}	
	});
			
	$(".p2 select").change(function() {
		resetDisplay();
		var name = $(".p2 option:selected").html();
		$(".p2 .p2-text, .names-time .p2-text").html(name);
		if(name == "Player 2") {
			p2.status = "initial";
			editor2.getSession().setValue(customFn2);
			editor2.setReadOnly(false);
			$(".p2 .save").removeAttr("disabled");
			$(".p2 .message").empty().css("visibility","hidden");
		}
		else {
			var fn = sampleBots[name];
			editor2.getSession().setValue(fn);
			editor2.setReadOnly(true);
			save(p2, fn);
		}	
	});
	
	$(".p1 .save").click(function() {
		customFn1 = editor1.getSession().getValue();
		save(p1, customFn1);		
	});

	$(".p2 .save").click(function() {
		customFn2 = editor2.getSession().getValue();
		save(p2, customFn2);		
			
	});
};

})();

$(document).ready(RoboTag.demo());
