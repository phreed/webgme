/*
 * Copyright (C) 2012 Vanderbilt University, All rights reserved.
 * 
 * Author: Miklos Maroti
 */

var requirejs = require("requirejs");

requirejs.config({
	nodeRequire: require,
	baseUrl: ".."
});

requirejs([ "util/assert", "storage/mongo", "storage/cache", "core/tasync" ], function (ASSERT, Mongo, Cache, TASYNC) {
	"use strict";

	var argv = process.argv.slice(2), argvIndex = 0;

	function nextParam (defValue) {
		return (argvIndex < argv.length && argv[argvIndex].charAt(0) !== "-") ? argv[argvIndex++] : defValue;
	}

	var commands = {};

	commands.help = function () {
		console.log("Usage: node main.js [commands]");
		console.log("");
		console.log("This script executes a sequence of core commands that can be chained together,");
		console.log("where each command is one of the following.");
		console.log("");
		console.log("  -help\t\t\t\tprints out this help");
		console.log("  -mongo <host> [<db> [<proj>]]\topens the database and project");
		console.log("  -dump\t\t\t\tdumps the content of the project");
		console.log("  -erase\t\t\tremoves all objects from the project");
		console.log("  -readxml <file>\t\treads and parses the given xml file");
		console.log("  -root <sha1>\t\t\tselects a new root by hash");
		console.log("  -dumptree\t\t\tdumps the current root as a json object");
		console.log("  -traverse\t\t\tloads all core objects from the current tree");
		console.log("  -parsemeta\t\t\tparses the current xml root as a meta project");
		console.log("  -parsedata\t\t\tparses the current xml root as a gme project");
		console.log("  -test <integer>\t\texecutes a test program (see tests.js)");
		console.log("  -setbranch [<branch>]\t\twrites the current root to the given branch");
		console.log("  -getbranch [<branch>]\t\treads the current root for the given branch");
		console.log("  -wait <secs>\t\t\twaits the given number of seconds");
		console.log("");
	};

	var database = null, project = null, projectName, root = "";

	commands.mongo = function () {
		ASSERT(!database && !project);

		var opt = {};
		opt.host = nextParam("localhost");
		opt.database = nextParam("webgme");
		projectName = nextParam("test");
		opt.port = nextParam();
		opt.port = opt.port && parseInt(opt.port, 10);

		console.log("Opening project " + opt.database + "/" + opt.project + " on " + opt.host);

		var d = new Cache(new Mongo(opt), {});
		d.openDatabase = TASYNC.wrap(d.openDatabase);
		d.openProject = TASYNC.wrap(d.openProject);
		d.deleteProject = TASYNC.wrap(d.deleteProject);
		d.closeDatabase = TASYNC.wrap(d.closeDatabase);

		return TASYNC.call(function () {
			return TASYNC.call(function (p) {
				p.closeProject = TASYNC.wrap(p.closeProject);
				p.dumpObjects = TASYNC.wrap(p.dumpObjects);
				p.findHash = TASYNC.wrap(p.findHash);
				p.setBranchHash = TASYNC.wrap(p.setBranchHash);
				p.getBranchHash = TASYNC.wrap(p.getBranchHash);

				database = d;
				project = p;
			}, d.openProject(projectName));
		}, d.openDatabase());
	};

	commands.close = function () {
		var p = project, d = database;
		project = null;
		database = null;

		if (p) {
			console.log("Closing project");

			return TASYNC.call(function () {
				return d.closeDatabase();
			}, p.closeProject());
		}
	};

	commands.wait = function () {
		var opt = nextParam();

		if (typeof opt === "string") {
			opt = parseInt(opt, 10);
		}

		if (typeof opt !== "number" || opt < 0) {
			opt = 1;
		}

		console.log("Waiting " + opt + " seconds ...");
		return TASYNC.delay(1000 * opt);
	};

	commands.dump = function () {
		ASSERT(project);

		console.log("Dumping all data ...");
		return TASYNC.call(function () {
			console.log("Dumping done");
		}, project.dumpObjects());
	};

	commands.erase = function () {
		ASSERT(database);

		console.log("Deleting project: " + projectName);
		return database.deleteProject(projectName);
	};

	commands.root = function () {
		ASSERT(project);

		var start = nextParam("");
		if (start === "") {
			console.log("Root is cleared");
			root = "";
			return;
		}

		if (start.charAt(0) !== "#") {
			start = "#" + start;
		}

		return TASYNC.trycatch(function () {
			return TASYNC.call(function (hash) {
				console.log("Root set to " + hash);
				root = hash;
			}, project.findHash(start));
		}, function (error) {
			console.log("Error: " + error.message);
		});
	};

	commands.setbranch = function () {
		ASSERT(project);

		var branch = nextParam("*master");
		if (branch.charAt(0) !== "*") {
			branch = "*" + branch;
		}

		if (root === "") {
			console.log("Clearing branch " + branch);
		} else {
			console.log("Setting branch " + branch + " to " + root);
		}

		return TASYNC.call(function (oldhash) {
			return project.setBranchHash(branch, oldhash, root);
		}, project.getBranchHash(branch, null));
	};

	commands.getbranch = function () {
		ASSERT(project);

		var branch = nextParam("*master");
		if (branch.charAt(0) !== "*") {
			branch = "*" + branch;
		}

		console.log("Getting branch " + branch);

		return TASYNC.call(function (oldhash) {
			if (oldhash !== "") {
				console.log("Root set to " + oldhash);
			} else {
				console.log("Root is cleared");
			}
			root = oldhash;
		}, project.getBranchHash(branch, null));
	};

	var runExternal = TASYNC.wrap(function (module, callback) {
		requirejs(module, function (func) {
		});
	});

	commands.readxml = function () {
		ASSERT(project);

		var xmlfile = nextParam();
		if (typeof xmlfile !== "string") {
			throw new Error("xml file not is not specified");
		}

		requirejs([ "cli/readxml" ], function () {
			console.log("loaded");
		});
	};

	// --- main 

	function runNextCommand () {
		if (argvIndex >= argv.length) {
			return;
		}

		var name = argv[argvIndex++];
		if (name.charAt(0) !== "-") {
			throw new Error("Command does not start with a dash: " + name);
		}

		var cmd = commands[name.substr(1)];
		if (typeof cmd !== "function") {
			throw new Error("Unknown command: " + name);
		}

		var done = cmd();
		return TASYNC.call(runNextCommand, done);
	}

	if (argv.length <= 0) {
		commands.help();
	} else {
		argv.push("-close");
		TASYNC.trycatch(runNextCommand, function (err) {
			console.log(err.trace || err.stack);

			if (database) {
				return commands.close();
			}
		});
	}
});