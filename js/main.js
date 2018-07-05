$(document).ready(function() {
    DV.Session.get_session(main);
});

function main(err,session) {

    $("#mainloader").addClass("hide");

    // Check for errors getting a session
    if(err){
        console.error(err);

        // Do some bug tracking
        var username = "NULL";
        try{username = JSON.parse(localStorage.getItem("dv_data"))["username"];}
        catch(e){}

        DV.Tracker.submit(username,err.message,localStorage.getItem("dv_data"));

        // Clear their session and let them try to login agian 
        DV.Session.clear_session();
        window.location.replace("./index.html");
        return;
    }

    var username = session.username;

    var messageQueue = {
        global: []
    }
    
    $(".subtitle h2").text("Welcome back, " + username);
    $(".welcomemessage").text("Welcome " + username);

    // Cache the area data instead of fetching it everytime
    var area;
    
    var player = {
        area: "dormaus_entrance",
        dust: 0,
        description: "This adventurer is an ordinary human.",
        equipment: {
            head: null,
            clothes: null,
            weapon: null,
            feet: null,
            ally: null
        },
        stats: {
            stealth: 1,
            might: 1,
            magic: 1,
            charm: 1
        },
        statprogress: {
            stealth: 0,
            might: 0,
            magic: 0,
            charm: 0
        },
        items: {},
        attributes: {},
        suffering: {
            pain: {
                value: 0,
                progress: 0
            },
            guilt: {
                value: 0,
                progress: 0
            },
            outcast: {
                value: 0,
                progress: 0
            },
            curse: {
                value: 0,
                progress: 0
            }
        }
    };
    
    var temporary_parameters = [];
    
    var savedKeys = Object.keys(session.save);
    for (var i = 0; i < savedKeys.length; i++) {
        player[savedKeys[i]] = session.save[savedKeys[i]];
    }
    console.log(player);

    session.save = player;
    player = session.save;
    
    $("#logout").on("click", function() {
        DV.Session.clear_session();
        window.location.replace("./index.html");
    });
    
    var currentChannel = "local";
    var client;
    
    var onlineUsers = [username];
    var userMap = {};
    userMap[username] = new Date();
    var userDescriptions = {};
    userDescriptions[username] = player.description;
    var userAreas = {};
    userAreas[username] = player.area;
    
    $("#openchat").click(function() {

        client = new DV.Socket(session);
        client.on_packet = function (err,packet){
            
            if(err){
                console.error(err);
                return;
            }

            if(packet.type == "message"){
                console.log("Message arrived");

                var recMessage = packet;
                if (!messageQueue[recMessage.area]) {
                    messageQueue[recMessage.area] = [];
                }
    
                var formattedMessage = {
                    user: recMessage.user,
                    text: recMessage.text,
                    mod: recMessage.mod,
                    area: recMessage.area
                };
                messageQueue[recMessage.area].push(formattedMessage);
                receiveSpell(recMessage);
                appendChat(formattedMessage);
                unreadMessage(formattedMessage);
            } else if (packet.type == "heartbeat") {
            	console.log("heartbeat received");
            	var heartBeat = packet;
            	updateWhoIs({
            		user: heartBeat.user,
            		description: heartBeat.description,
            		area: heartBeat.area
            	});
            }

        };

        client.connect(function(err){

            if(err){
                console.error(err);
                return;
            }

            setInterval(sendHearbeat, 1000*30);
            drawWhoIs();
            
            $("#right .centerbox").empty();
            $("#right .centerbox").append(
                    '<div id="chattabs"><div id="localtab" class="chattab active">Local<div class="newmessage">!</div></div><div id="globaltab" class="chattab">Global<div class="newmessage">!</div></div></div>' +
                    '<div id="whois"></div>' +
                    '<div id="chatbox"></div>' +
                    '<input id="chatfield" type="text" value="">'
            );
            
            // publish a lifecycle event
            var enter_message = {user : username, mod : "normal", area: player.area, text: "/me joined"};
            client.send("global","message",enter_message);
        });
    });
    
    function receiveSpell(message) {
        if (username == message.target) {
            temporary_parameters.push(message.spell);
        }
    };
    
    function sendHearbeat() {
        var descToUse = player.description;
        if (player.trapped_desc) {
            descToUse = player.trapped_desc;
        }
    	client.send("global", "heartbeat", {user: username, description: descToUse, area:player.area});
    	timeoutUserLog();
    }
    
    function updateWhoIs(message) {
    	userMap[message.user] = new Date();
    	userDescriptions[message.user] = message.description;
    	userAreas[message.user] = message.area;
    	if (!onlineUsers.includes(message.user)) {
    		onlineUsers.push(message.user);
    		drawWhoIs();
    	}
    };
    
    function timeoutUserLog() {
    	var now = new Date();
    	var users = [];
    	for (var i = 0; i < onlineUsers.length; i++) {
    		var lastTime = userMap[onlineUsers[i]];
    		if ((Date.parse(now) - Date.parse(lastTime)) < 1000*60) {
    			users.push(onlineUsers[i]);
    		}
    	}
    	onlineUsers = users;
    	drawWhoIs();
    };
    
    function drawWhoIs() {
    	$("#whois").empty();
    	$("#whois").append('<div class="whohere"></div>');
    	$("#whois").append('<div class="whothere"></div>');
    	for (var i = 0; i < onlineUsers.length; i++) {
    		var description = userDescriptions[onlineUsers[i]] || "Unknown player";
    		var whoarea = userAreas[onlineUsers[i]] || "global";
    		var newUserBox = $('<div class="user" data-description="' + description + '"></div>');
    		newUserBox.text(onlineUsers[i]);
    		if (whoarea == player.area) {
    		    $("#whois .whohere").append(newUserBox);
    		} else {
    		    $("#whois .whothere").append(newUserBox);
    		}
    	}
    }
    
    function unreadMessage(message) {
        if (currentChannel == "global" && message.area != "global") {
            $("#localtab").addClass("notification");
        } else if (currentChannel == "local" && message.area == "global") {
            $("#globaltab").addClass("notification");
        }
    }
    
    function appendChat(message) {
        if ((currentChannel == "global" && message.area == "global") || (currentChannel == "local" && message.area == player.area)) {
            var appendMessage = "";
            var newp = $("<p></p>");
            var usertext = $("<b></b>");
            var newpp = $("<b></b>");
            if (message.text.startsWith("/me")) {
                appendMessage = message.user + message.text.replace("/me", "");
                newp.text(appendMessage);
                $("#chatbox").append(newp);
            } else {
                usertext.text(message.user + ": ");
                appendMessage = message.text;
                newp.append(usertext);
                newp.append(newpp);
                newpp.text(appendMessage);
                $("#chatbox").append(newp);
            }
        }
        $('#chatbox').scrollTop($('#chatbox')[0].scrollHeight);
    }
    
    $("#right").on("click", "#localtab", function() {
        $("#localtab").removeClass("notification");
        currentChannel = "local";
        $("#localtab").addClass("active");
        $("#globaltab").removeClass("active");
        $("#chatbox").empty();
        if (!messageQueue[player.area]) {
            messageQueue[player.area] = [];
        }
        for (var i = 0; i < messageQueue[player.area].length; i++) {
            appendChat(messageQueue[player.area][i]);
        }
    });
            
    $("#right").on("click", "#globaltab", function() {
        $("#globaltab").removeClass("notification");
        currentChannel = "global";
        $("#localtab").removeClass("active");
        $("#globaltab").addClass("active");
        $("#chatbox").empty();
        for (var i = 0; i < messageQueue.global.length; i++) {
            appendChat(messageQueue.global[i]);
        }
    });
    
    function stupidFilter(text) {
        var beastnoises = ["bark", "woof", "arf"];
        var result = text;
        if (player.attributes.intelligence && player.attributes.intelligence.value == 1) {
            if (!text.startsWith("/me")) {
                var words = text.split(" ");
                var newwords = [];
                for (var i = 0; i < words.length; i++) {
                    var bark = beastnoises[Math.floor(Math.random()*beastnoises.length)];
                    newwords.push(bark);
                }
                result = newwords.join(" ");
            }
        }
        return result;
    };
    
    var spells = ["fox", "rabbit", "vore"];
    var spellRequirements = {
        fox: 1,
        rabbit: 1,
        vore: 2,
        heat: 3
    };
    var spellCasts = {
        fox: '{caster} casts fox on {target}. Their skin prickles as they develop soft, fluffy orange fur. The fur becomes light and peachy on their neck and chest, and dark at their hands and feet. Their head stretches forward into a pointed muzzle, while their ears grow pointed and fluffy. A long, bushy tail sprouts from their rear, swaying in the air as they become a fluffy fox.',
        rabbit: '{caster} casts rabbit on {target}. Their skin prickles as they develop soft, silky white fur. It spreads down their body, and when it hits their legs, they thicken with muscle, then their feet grow long and thin. They start to shrink, and their head develops a small rounded muzzle, while their ears grow enormously long, stretching above their head and twitching in the air. A soft, white cottontail sprouts from their rear, bobbing in the air as they become a cuddly rabbit!',
        vore: '{caster} casts the vore spell, and their body glows with power. They open their mouth revealing large fanged teeth dripping with drool. Their face contorts into a snarling, predatory grimace and their belly growls loudly. With beastlike rage, they grab {target} and grip them firmly in their hands. Opening their jaw wide, they start to shove {target} into their mouth. They drool and snarl as the victim wriggles and struggles in their grip. Their tongue licks over the victim as you they to swallow, dragging the prey into their throat. Their neck bulges with the victim\'s desperate form, and with another swallow the bulge slides down into their belly. They lick their lips, patting the big round bulge in their stomach.',
        heat: '3'
    };
    
    function fillSpell(text, user, target) {
        text = text.replace(/{caster}/gi, user);
        text = text.replace(/{target}/gi, target);
        return text;
    }
    
    function isCasting(text) {
        var result = false;
        for (var i = 0; i < spells.length; i++) {
            var incantation = "/" + spells[i];
            if (text.startsWith(incantation)) {
                result = spells[i];
            }
        }
        return result;
    }
    
    $("#right").on("keyup", "#chatfield", function(event) {
        event.preventDefault();
        if (event.keyCode === 13) {
            var rawtext = $("#chatfield").val();
            var spell = isCasting(rawtext);
            if (spell) {
                var target = rawtext.replace("/" + spell + " ", "");
                userAreas[onlineUsers[i]]
                if (onlineUsers.includes(target)) {
                    if (userAreas[target] == player.area) {
                        var magelevel = 0;
                        if (player.attributes.magicuser && player.attributes.magicuser.value) {
                            magelevel = player.attributes.magicuser.value;
                        }
                        var requiredLevel = spellRequirements[spell];
                        console.log("Level needed " + requiredLevel + " have " + magelevel);
                        if (magelevel >= requiredLevel) {
                            var rawSpell = spellCasts[spell];
                            var finalSpell = fillSpell(rawSpell, username, target);
                            var enter_message = {
                                user : "System",
                                mod : "normal", 
                                area: player.area, 
                                text: finalSpell,
                                target: target,
                                spell: spell
                            };
                            client.send("global","message",enter_message);
                        } else {
                            appendChat({
                                user: "System",
                                area: player.area,
                                text: "Your do not know that spell"
                            });
                        }
                    } else {
                        appendChat({
                            user: "System",
                            area: player.area,
                            text: "Your target is too far away"
                        });
                    }
                } else {
                    appendChat({
                        user: "System",
                        area: player.area,
                        text: "No such adventurer found"
                    });
                }
                $("#chatfield").val("");
            } else {
                var text = stupidFilter(rawtext);
                var area = player.area;
                if (currentChannel == "global") {
                    area = "global";
                }
                var enter_message = {user : username, mod : "normal", area: area, text: text};
                client.send("global","message",enter_message);
                $("#chatfield").val("");
            }
        }
    });
    
    function updateStat(stat) {
        var value = player.stats[stat]+1;
        var requirement = calculateNext(value);
        var currentPoints = player.statprogress[stat];
        var percentage = currentPoints/requirement;
        var width = Math.floor($("." + stat + " .progressbox").width()*percentage);
        $("." + stat + " .progress").width(width);
        $("." + stat + " .paramnum .param").text(player.stats[stat]);
    }
    
    function gainStat(stat, points) {
        var value = player.stats[stat]+1;
        var requirement = calculateNext(value);
        player.statprogress[stat] += points;
        var currentPoints = player.statprogress[stat];
        var percentage = currentPoints/requirement;
        if (percentage > 1) {
            
        } else {
            var width = Math.floor($("." + stat + " .progressbox").width()*percentage);
            $("." + stat + " .progress").width(width);
        }
        
    }
    
    updateStats();
    
    function calculateNext(value) {
//    	var requirement = 0;
//    	for (var i = 1; i <= value; i++) {
//    		requirement += i;
//    	}
//    	return requirement;
        return value;
    }
    
    $(".tab").on("click", function() {
        var id = $(this).attr("id");
        switchTabs(id);
    });
    
    $( window ).resize(function() {
        //displayMap();
    });
    
    function switchTabs(id) {
        $(".tab").removeClass("active");
        $("#" + id).addClass("active");
        $(".hidebox").addClass("hidden");
        if (id == "tab1") {
            $("#box1").removeClass("hidden");
        } else if (id == "tab2") {
            displayInventory();
            $("#box2").removeClass("hidden");
        } else if (id == "tab3") {
            hideMap();
            $("#box3").removeClass("hidden");
        } else if (id == "tab4") {
            $("#box4").removeClass("hidden");
        }
    }
    
    function eventValid(event, player) {
        return true;
    };
    
    $("#box1").on("click", ".npc", function() {
        displayConversation($(this).attr("id"));
    });
    
    $("#box1").on("click", "input.openevent", function() {
        var data = $(this).data();
        displayEvent(data.event);
    });
    
    $("#box1").on("click", "input.endevent", function() {
        displayArea(player.area);
    });
    
    $("#box2").on("click", ".equipment", function() {
        var data = $(this).data();
        equipItem(data.slot, data.itemid);
    });
    
    $("#box2").on("click", ".equipicon", function() {
        var data = $(this).data();
        removeItem(data.slot);
    });
    
    $("#box3").on("click", "div.areabutton", function() {
        var data = $(this).data();
        player.area = data.area;
        displayArea(data.area);
        switchTabs("tab1");
        $("#chatbox").empty();
        if (!messageQueue[player.area]) {
            messageQueue[player.area] = [];
        }
        for (var i = 0; i < messageQueue[player.area].length; i++) {
            appendChat(messageQueue[player.area][i]);
        }
    });
    
    $("#box4").on("click", "div.dialogueoption", function() {
        var data = $(this).data();
        displayConvResponse(data.npc, data.response);
    });
    
    $("#box4").on("click", "#closeDialogue", function() {
        returnToConversation();
    });
    
    $("#box4").on("click", ".buybutton", function(e) {
        e.preventDefault();
        var data = $(this).data();
        var itemtype = data.item;
        var quantity = $(".buyfield." + itemtype).val();
        if (DV.Data.item_data[itemtype] && quantity && quantity > 0) {
            var iteminfo = DV.Data.item_data[itemtype];
            var price = iteminfo.value*2*quantity;
            if (player.dust >= price) {
                player.dust -= price;
                player.items[itemtype] = quantity;
                updateStats();
                $(".shopicon." + itemtype).text(player.items[itemtype]);
            }
        }
    });
    
    $("#box4").on("click", ".sellbutton", function(e) {
        e.preventDefault();
        var data = $(this).data();
        var itemtype = data.item;
        var quantity = $(".sellfield." + itemtype).val();
        if (DV.Data.item_data[itemtype] && quantity && quantity > 0) {
            var iteminfo = DV.Data.item_data[itemtype];
            var price = iteminfo.value*quantity;
            if (player.items[itemtype] >= quantity) {
                player.dust += price;
                player.items[itemtype] -= quantity;
                updateStats();
                $(".shopicon." + itemtype).text(player.items[itemtype]);
            }
        }
    });
    
    $("#box1").on("mouseenter", ".outcomeicon", mouseInIcon);
    $("#box1").on("mouseleave", ".outcomeicon", mouseOutIcon);
    
    $("#box2").on("mouseenter", ".inventoryslot", mouseInIcon);
    $("#box2").on("mouseleave", ".inventoryslot", mouseOutIcon);
    
    $("#box4").on("mouseenter", ".shopicon", mouseInIcon);
    $("#box4").on("mouseleave", ".shopicon", mouseOutIcon);
    
    $("#right").on("mouseenter", ".user", mouseInUser);
    $("#right").on("mouseleave", ".user", mouseOutIcon);
    
    function displayMap() {
        updateMap();
    };
    
    function mouseInUser() {
        var data = $(this).data();
        var desc = data.description;
        
        $(".overlaytitle").text("");
        $(".overlaytext").empty();
        $(".overlaytext").append(desc);
        $('#iconoverlay').css({
            "top" : $(this).offset().top + 10,
            "left" : $(this).offset().left + 110
        });
        $("#iconoverlay").removeClass("hide");
    }
    
    function mouseInIcon() {
        var data = $(this).data();
        var title = data.title;
        var desc = data.desc;
        var itemid = data.itemid;
        
        var itemblock = DV.Data.item_data[itemid];
        
        if (itemblock && itemblock.attributes) {
            var atts = Object.keys(itemblock.attributes);
            for (var i = 0; i < atts.length; i++) {
                var att = capitalizeFirstLetter(atts[i]);
                var quantity = itemblock.attributes[atts[i]];
                var sign = "+";
                if (quantity < 0) {
                    sign = "-";
                }
                desc += "<p>" + att + ": " + sign + quantity + "</p>";
            }
        }
        
        $(".overlaytitle").text(title);
        $(".overlaytext").empty();
        $(".overlaytext").append(desc);
        $('#iconoverlay').css({
            "top" : $(this).offset().top + 10,
            "left" : $(this).offset().left + 110
        });
        $("#iconoverlay").removeClass("hide");
    }
    
    function mouseOutIcon() {
        $("#iconoverlay").addClass("hide");
    }
    
    function equipItem(slot, id) {
        player.equipment[slot] = id;
        displayInventory();
        updateStats();
    }
    
    function removeItem(slot) {
        player.equipment[slot] = null;
        displayInventory();
        updateStats();
    }
    
    function updateStats() {
        var stealthBonus = getItemBonus("stealth");
        var mightBonus = getItemBonus("might");
        var magicBonus = getItemBonus("magic");
        var charmBonus = getItemBonus("charm");
        $(".dustcount").text(player.dust);
        var pre = '';
        if (stealthBonus >= 0) {
            pre = "+"
        } else {
            pre = "";
        }
        $(".stealth .paramnum .param").text(player.stats.stealth);
        $(".stealth .numbonus").text(pre+stealthBonus);
        
        if (mightBonus >= 0) {
            pre = "+"
        } else {
            pre = "";
        }
        $(".might .paramnum .param").text(player.stats.might);
        $(".might .numbonus").text(pre+mightBonus);
        
        if (magicBonus >= 0) {
            pre = "+"
        } else {
            pre = "";
        }
        $(".magic .paramnum .param").text(player.stats.magic);
        $(".magic .numbonus").text(pre+magicBonus);
        
        if (charmBonus >= 0) {
            pre = "+"
        } else {
            pre = "";
        }
        $(".charm .paramnum .param").text(player.stats.charm);
        $(".charm .numbonus").text(pre+charmBonus);
    }
    
    function getItemBonus(stat) {
        var bonus = 0;
        var item;
        if (player.equipment.head) {
            item = DV.Data.item_data[player.equipment.head];
            if (item.attributes[stat]) {
                bonus += item.attributes[stat];
            }
        }
        if (player.equipment.clothes) {
            item = DV.Data.item_data[player.equipment.clothes];
            if (item.attributes[stat]) {
                bonus += item.attributes[stat];
            }
        }
        if (player.equipment.weapon) {
            item = DV.Data.item_data[player.equipment.weapon];
            if (item.attributes[stat]) {
                bonus += item.attributes[stat];
            }
        }
        if (player.equipment.feet) {
            item = DV.Data.item_data[player.equipment.feet];
            if (item.attributes[stat]) {
                bonus += item.attributes[stat];
            }
        }
        if (player.equipment.ally) {
            item = DV.Data.item_data[player.equipment.ally];
            if (item.attributes[stat]) {
                bonus += item.attributes[stat];
            }
        }
        return bonus;
    };
    
    function hideMap() {
        DV.Data.load_area(player.area,function(err,area_data){
            if (area_data) {
                var currentareaname = area_data.title;
                $(".areabutton").removeClass("currentareabutton");
                console.log(currentareaname);
                $(".areabutton[data-area=" + currentareaname + "]").addClass("currentareabutton");
                
                if (player.trapped) {
                    $("#box3 .map").addClass("hide");
                    $("#box3 .mapblock").removeClass("hide");
                    $("#box3 .mapblock").empty();
                    $("#box3 .mapblock").append('<p>' + player.trapped + '</p>');
                } else if (area_data.nomap) {
                    $("#box3 .map").addClass("hide");
                    $("#box3 .mapblock").removeClass("hide");
                    var noMapText = "You don't know your way around this area yet. You'll have to navigate on foot.";
                    if (area_data.nomap) {
                        noMapText = area_data.nomap;
                    }
                    $("#box3 .mapblock").empty();
                    $("#box3 .mapblock").append('<p>' + noMapText + '</p>');
                } else {
                    $("#box3 .map").removeClass("hide");
                    $("#box3 .mapblock").addClass("hide");
                }
            }
        });
    }
    
    function updateMap() {
        $("#box3").empty();
        $("#box3").append('<div class="mapblock hide"></div><div class="map"></div>');
        var width = $("#box3").width();
        $(".map").width("100%");
        $(".map").css("padding-top","100%");
        $(".map").empty();
        var areaIds = Object.keys(DV.Data.areas);
        var width = $(".map").width();
        for (var i = 0; i < areaIds.length; i++) {
            var areaId = areaIds[i];
            DV.Data.load_area(areaId,function(err,area_data){
                if (area_data.position) {
                    var x = area_data.position[0]*100;
                    var y = area_data.position[1]*100;
                    if (areaId == player.area) {
                        $(".map").append('<div title="' + area_data.header + '" style="left: ' + x + '%; top: ' + y + '%" class="areabutton currentareabutton" data-area="' + area_data.title + '"></div>');
                    } else {
                        $(".map").append('<div title="' + area_data.header + '" style="left: ' + x + '%; top: ' + y + '%" class="areabutton" data-area="' + area_data.title + '"></div>');
                    }
                }
            });
//		        $(".map").append('<div style="left: ' + x + 'px; top: ' + y + 'px" class="areabutton" data-area="' + areaId + '"></div>');
        }
    }
    
    function getEventResolution(event) {
        var result = {};
        if (event.type == "statcheck") {
            var quality = player.stats[event.stat];
            var difficulty = event.difficulty;
            var successChance = getSuccessChance(event)
            var exp = 1;
            if (Math.random() < successChance) {
                exp = getExperience(true, successChance);
                if (event.results.rareSuccess && Math.random() < 0.2) {
                    result = JSON.parse(JSON.stringify(event.results.rareSuccess));
                } else {
                    result = JSON.parse(JSON.stringify(event.results.success));
                }
            } else {
                exp = getExperience(false, successChance);
                if (event.results.rareFail && Math.random() < 0.2) {
                    result = JSON.parse(JSON.stringify(event.results.rareFail));
                } else {
                    result = JSON.parse(JSON.stringify(event.results.fail));
                }
            }
            result.outcomes.push({
                "parameter": event.stat,
                "quantity": exp,
                "change": "add"
            });
        } else {
            var resultId = getRandom(Object.keys(event.results));
            return event.results[resultId];
        }
        return result;
    }
    
    function getRandom(array) {
        var index = Math.floor(Math.random()*array.length);
        return array[index];
    }
    
    function getExperience(success, probability) {
        if (probability > 0.9) {
            return 1;
        } else if (probability > 0.6) {
            if (success) {
                return 2;
            } else {
                return 1;
            }
        } else if (probability > 0.4) {
            if (success) {
                return 3;
            } else {
                return 1;
            }
        } else if (probability > 0.3) {
            if (success) {
                return 4;
            } else {
                return 2;
            }
        } else if (probability > 0.1) {
            if (success) {
                return 5;
            } else {
                return 3;
            }
        } else {
            if (success) {
                return 6;
            } else {
                return 4;
            }
        }
    }
    
    function getResolutions(event) {
        var outcome = JSON.parse(JSON.stringify(getEventResolution(event)));
        if (event.type == "statcheck") {
            var exp = getExperience(outcome, p);
        }
    }
    
    //TODO: Move this to a function-event when those exist
    var fixStuckEvent = {
        "id": "save_me_batty",
        "title": "Save me Mr Bat!",
        "trapped": true,
        "subtitle": 'A tall bat in a cloak bumps into you, and blinks with surprise. "Oh my! Do you require assistance?"',
        "type": "random",
        "requirements": [
        ],
        "icon": "mrbat",
        "results": {
            "success": { 
                "text": 'The bat adjusts his glasses and takes a close look at you. He strokes his chin for a moment, then opens up his long cloak. From within, he draws out a small black book and reads it thoughtfully. "Here you are, this should resolve your problem, my friend", he says. He touches the page and quickly mutters a long string of complex syllables. The words seem to spin and twirl around you, and for a moment your body feels completely fluid. There is a crackle and pop of electricity, and then with a sudden SNAP, the curse binding you is undone! </p>As you look down at yourself, your form restored, the bat gives you a little bow. "I am glad I found myself lost so that I could provide you assistance, my friend. Until we meet again!"',
                "freeTrap": true,
                "outcomes": [
                ]
            }
        }
    };
    
    Array.prototype.remove = function() {
        var what, a = arguments, L = a.length, ax;
        while (L && this.length) {
            what = a[--L];
            while ((ax = this.indexOf(what)) !== -1) {
                this.splice(ax, 1);
            }
        }
        return this;
    };
    
    function displayEvent(eventId) {
        var event = null;
        for (var i = 0; i < area.events.length; i++) {
            if (area.events[i].id == eventId) {
                event = area.events[i];
            }
        }
        for (var i = 0; i < global_area.events.length; i++) {
            if (global_area.events[i].id == eventId) {
                event = global_area.events[i];
            }
        }
        if (event) {
            var outcome = getEventResolution(event);
            
            if (outcome.trapped && outcome.trapped_desc) {
                player.trapped = outcome.trapped;
                player.trapped_desc = outcome.trapped_desc;
            } else if (outcome.freeTrap) {
                player.trapped = null;
                player.trapped_desc = null;
            }
            
            if (outcome.clearTemp) {
                temporary_parameters.remove(outcome.clearTemp);
            }
            
            var updated = player.last_updated;
            if (outcome.newchar) {
                player.trapped = null;
                player.trapped_desc = null;
                player.area = outcome.newchar.area;
                player.dust = outcome.newchar.dust;
                player.description = outcome.newchar.description;
                player.equipment = outcome.newchar.equipment;
                player.stats = outcome.newchar.stats;
                player.statprogress = outcome.newchar.statprogress;
                player.items = outcome.newchar.items;
                player.attributes = outcome.newchar.attributes;
                player.suffering = outcome.newchar.suffering;
            }
            
            if (outcome.reset == "minor") {
                player.attributes = {};
            }
            
            if (outcome.reset == "major") {
                player.area = "dormaus_entrance";
                player.dust = 0;
                player.description = "This adventurer is an ordinary human.";
                player.equipment = {
                    head: null,
                    clothes: null,
                    weapon: null,
                    feet: null,
                    ally: null
                };
                player.stats = {
                    stealth: 1,
                    might: 1,
                    magic: 1,
                    charm: 1
                };
                player.statprogress = {
                    stealth: 0,
                    might: 0,
                    magic: 0,
                    charm: 0
                };
                player.items = {};
                player.attributes = {};
                player.suffering = {
                    pain: {
                        value: 0,
                        progress: 0
                    },
                    guilt: {
                        value: 0,
                        progress: 0
                    },
                    outcast: {
                        value: 0,
                        progress: 0
                    },
                    curse: {
                        value: 0,
                        progress: 0
                    }
                };
            }
            
            if (outcome.area) {
                player.area = outcome.area; 
            }
            
            if (outcome.descriptionchange) {
                player.description = outcome.descriptionchange;
            }
            
            $("#box1").empty();
            $("#box1").append(
                '<div class="eventdata">' +
                '<div class="eventiconholder">' +
                '<div class="eventicon ' + event.icon + '"></div>' +
                '</div>' +
                '<div class="eventtext">' +
                '<p>' + outcome.text + '</p>' +
                '</div>' +
                '</div>'
            );
            if (event.stat) {
                $("#box1").append(
                    '<div class = "statboost">' +
                    '<div class = "statboosticon ' + event.stat + '"></div>' +
                    '<div class = "statboostprogressbox">' +
                    '<div class = "statboostprogress"></div>' +
                    '</div>' +
                    '</div><hr>'
                );
            }
            for (var i = 0; i < outcome.outcomes.length; i++) {
                var quantity = 0;
                
                var oAtt = DV.Data.item_data[outcome.outcomes[i].parameter];
                if (outcome.outcomes[i].quantity) {
                    quantity = outcome.outcomes[i].quantity;
                } else {
                    quantity = Math.floor(event.difficulty/oAtt.value) || 0;
                }
                var iconTitle = oAtt.title;
                var iconDesc;
                if (oAtt.description.length == 1) {
                    iconDesc = oAtt.description[0];
                }
                var outcometext = "";
                if (oAtt.type == "attribute" || oAtt.type == "suffering" || oAtt.type == "stat") {
                    var animationDetails = addValuesToPlayer(outcome.outcomes[i].parameter, quantity, outcome.outcomes[i].change, outcome.outcomes[i].max)
                    if (animationDetails[2] > oAtt.description.length) {
                        iconDesc = oAtt.description[oAtt.description.length-1];
                    } else if (animationDetails[2]-1 < 0) {
                        iconDesc = oAtt.description[0];
                    } else {
                        iconDesc = oAtt.description[animationDetails[2]-1];
                    }
                    $("#box1").append(
                        '<div class = "outcome out' + i + '">' +
                        '<div data-itemid="' + outcome.outcomes[i].parameter + '" data-title = "' + iconTitle + '" data-desc = "' + iconDesc + '" class = "outcomeicon ' + oAtt.icon + '"><div>' + animationDetails[2] + '</div></div>' +
                        '<div class = "outcomebar"><div class = "outcomeprogress"></div></div>' +
                        '</div>'
                    );
                    var width1 = Math.floor($(".outcome .outcomebar").width()*animationDetails[0]);
                    var width2 = Math.floor($(".outcome .outcomebar").width()*animationDetails[1]);
                    $(".out" + i + " .outcomeprogress").width(width1);
                    $(".out" + i + " .outcomeprogress").animate({
                        width:width2+'px'
                    });
                } else {
                    if (outcome.outcomes[i].change == "add") {
                        var randomAdd = 1+(Math.random()*0.2);
                        var newQuantity = Math.round(quantity*randomAdd);
                        addValuesToPlayer(outcome.outcomes[i].parameter, newQuantity, outcome.outcomes[i].change, outcome.outcomes[i].max)
                        outcometext = "Gained " + newQuantity + " " + oAtt.title;
                    } else if (outcome.outcomes[i].change == "set") {
                        addValuesToPlayer(outcome.outcomes[i].parameter, quantity, outcome.outcomes[i].change, outcome.outcomes[i].max)
                        outcometext = quantity + " now equals " + oAtt.title;
                    } else if (outcome.outcomes[i].change == "sub") {
                        addValuesToPlayer(outcome.outcomes[i].parameter, quantity, outcome.outcomes[i].change, outcome.outcomes[i].max)
                        outcometext = "Lost " + quantity + " " + oAtt.title;
                    }
                    $("#box1").append(
                        '<div class = "outcome">' +
                        '<div data-itemid="' + outcome.outcomes[i].parameter + '" data-title = "' + iconTitle + '" data-desc = "' + iconDesc + '" class = "outcomeicon ' + oAtt.icon + '"></div>' +
                        '<div class = "outcometext"><p>' + outcometext + '</p></div>' +
                        '</div>'
                    );
                }
            }
            $("#box1").append(
                '<hr><div class = "closeEvent eventinput">' +
                '<input type="submit" class="endevent" value="Ok"></input>' +
                '</div>'
            );
            
        } //Need to also add item gain, stat gain
    };
    
    function isEventValid(event) {
        if ((player.trapped && !event.trapped) || (!player.trapped && event.trapped)) {
            return false;
        }
        var valid = true;
        for (var i = 0; i < event.requirements.length; i++) {
            var req = event.requirements[i];
            if (req.temporary_param) {
                if (!temporary_parameters.includes(req.temporary_param)) {
                    valid = false;
                }
            } else {
                var oAtt = DV.Data.item_data[req.parameter];
                var value;
                if (oAtt.type == "suffering") {
                    value = player.suffering[req.parameter].value;
                } else if (oAtt.type == "attribute") {
                    if (!player.attributes[req.parameter]) {
                        value = 0;
                    } else {
                        value = player.attributes[req.parameter].value;
                    }
                    var equipBonus = getItemBonus(req.parameter);
                    value += equipBonus;
                } else if (oAtt.type == "item") {
                    if (!player.items[req.parameter]) {
                        value = 0;
                    } else {
                        value = player.items[req.parameter]
                    }
                } else if (oAtt.type == "stat") {
                    value = player.stats[req.parameter];
                }
                if (req.comparison == "greater" && value <= req.value) {
                    valid = false;
                } else if (req.comparison == "less" && value >= req.value) {
                    valid = false;
                } else if (req.comparison == "equal" && value != req.value) {
                    valid = false;
                } else if (req.comparison == "nequal" && value == req.value) {
                    valid = false;
                } else if (req.comparison == "gequal" && value < req.value) {
                    valid = false;
                } else if (req.comparison == "lequal" && value > req.value) {
                    valid = false;
                }
            }
        }
        return valid;
    }
    
    function addValuesToPlayer(parameter, quantity, type, max) { //returns [oldvalue, newvalue]
        var oAtt = DV.Data.item_data[parameter];
        if (oAtt.type == "suffering") {
            var value = player.suffering[parameter].value;
            if (type == "add") {
                if (!max || value < max) {
                    player.suffering[parameter].progress += quantity;
                }
                var progress = player.suffering[parameter].progress;
                var next = calculateNext(value+1);
                if (next <= progress) {
                    player.suffering[parameter].progress = 0;
                    player.suffering[parameter].value++;
                    return [1, 0, player.suffering[parameter].value];
                } else {
                    return [(progress-quantity)/next, progress/next, player.suffering[parameter].value];
                }
            } else if (type == "set") {
                player.suffering[parameter].progress = 0;
                player.suffering[parameter].value = quantity;
                return [1,0, player.suffering[parameter].value];
            } else if (type == "sub") {
                player.suffering[parameter].progress -= quantity;
                var progress = player.suffering[parameter].progress;
                var next = calculateNext(value+1);
                if (progress < 0) {
                    player.suffering[parameter].progress = 0;
                    player.suffering[parameter].value = player.suffering[parameter].value-1;
                    if (player.suffering[parameter].value < 0) {
                        player.suffering[parameter].value = 0;
                    }
                    return [1, 0, player.suffering[parameter].value];
                } else {
                    return [(progress+quantity)/next, progress/next, player.suffering[parameter].value];
                }
            }
        } else if (oAtt.type == "attribute") {
            if (!player.attributes[parameter]) {
                player.attributes[parameter] = {
                    value: 0,
                    progress: 0
                }
            }
            var value = player.attributes[parameter].value;
            if (type == "add") {
                if (!max || value < max) {
                    player.attributes[parameter].progress += quantity;
                }
                var progress = player.attributes[parameter].progress;
                var next = calculateNext(value+1);
                if (next <= progress) {
                    player.attributes[parameter].progress = 0;
                    player.attributes[parameter].value++;
                    return [1, 0, player.attributes[parameter].value];
                } else {
                    return [(progress-quantity)/next, progress/next, player.attributes[parameter].value];
                }
            } else if (type == "set") {
                player.attributes[parameter].progress = 0;
                player.attributes[parameter].value = quantity;
                return [1,0, player.attributes[parameter].value];
            } else if (type == "sub") {
                player.attributes[parameter].progress -= quantity;
                var progress = player.attributes[parameter].progress;
                var next = calculateNext(value+1);
                if (progress < 0) {
                    player.attributes[parameter].progress = 0;
                    player.attributes[parameter].value = player.attributes[parameter].value-1;
                    if (player.attributes[parameter].value < 0) {
                        player.attributes[parameter].value = 0;
                    }
                    return [1, 0, player.attributes[parameter].value];
                } else {
                    return [(progress+quantity)/next, progress/next, player.attributes[parameter].value];
                }
            }
        } else if (oAtt.type == "item") {
            if (!player.items[parameter]) {
                player.items[parameter] = 0;
            }
            if (type == "add") {
                player.items[parameter] += quantity;
            } else if (type == "set") {
                player.items[parameter] = quantity;
            } else if (type == "sub") {
                player.items[parameter] -= quantity;
                if (player.items[parameter] < 0) {
                    player.items[parameter] = 0;
                }
            }
            if (player.items[parameter] <= 0) {
                delete player.items[parameter];
            }
        } else if (oAtt.type == "stat") {
            var value = player.stats[parameter];
            if (type == "add") {
                if (!max || value < max) {
                    player.statprogress[parameter] += quantity;
                }
                var progress = player.statprogress[parameter];
                var next = calculateNext(value+1);
                if (next <= progress) {
                    player.statprogress[parameter] = 0;
                    player.stats[parameter]++;
                    updateStat(parameter);
                    return [1, 0, player.stats[parameter]];
                } else {
                    updateStat(parameter);
                    return [(progress-quantity)/next, progress/next, player.stats[parameter]];
                }
            } else if (type == "set") {
                player.statprogress[parameter] = 0;
                player.stats[parameter] = quantity;
                updateStat(parameter);
                return [1,0, player.stats[parameter]];
            } else if (type == "sub") {
                player.statprogress[parameter] -= quantity;
                var progress = player.statprogress[parameter];
                var next = calculateNext(value+1);
                if (progress < 0) {
                    player.statprogress[parameter] = 0;
                    player.stats[parameter] = player.stats[parameter]-1;
                    if (player.stats[parameter] < 0) {
                        player.stats[parameter] = 0;
                    }
                    updateStat(parameter);
                    return [1, 0, player.stats[parameter]];
                } else {
                    updateStat(parameter);
                    return [(progress+quantity)/next, progress/next, player.stats[parameter]];
                }
            }
        }
    };
    
    function displayConversation(npcId) {
        var npc = null;
        for (var i = 0; i < area.npcs.length; i++) {
            if (area.npcs[i].id == npcId) {
                npc = area.npcs[i];
            }
        }
        if (npc) {
            $("#box4").empty();
            $("#box4").append(
                '<div class="npcprofile">' +
                '<div class="npcprofileicon ' + npc.icon + '"></div>' +
                '<div class="npcfurtherinfo">' +
                '<p>' + npc.description + '</p>' +
                '</div>' +
                '</div>' +
                '<div class = "dialoguemenu">' +
                '<div class = "shop hidden"></div>' +
                '<div class = "dialogueoptions">'
            );
            if (npc.shop) {
                $(".dialoguemenu .shop").removeClass("hidden");
                if (npc.shop.buys) {
                    for (var i = 0; i < npc.shop.buys.length; i++) {
                        var itemtype = npc.shop.buys[i];
                        var shopitem = DV.Data.item_data[itemtype];
                        var quantity = player.items[itemtype] || 0;
                        $(".dialoguemenu .shop").append(
                            '<div class="shoprow">' +
                                '<div class="shopicon ' + shopitem.icon + '" data-itemid="' + itemtype + '" data-title="' + shopitem.title + '" data-desc="' + shopitem.description[0] + '">' + quantity + '</div>' +
                                '<div class="shopbuy">' +
                                '</div>' +
                                '<div class="shopsell">' +
                                    '<input class="' + itemtype + ' sellfield" data-item="' + itemtype + '" type="text" placeholder="' + shopitem.value + ' Dust to sell. Enter quantity.">' +
                                    '<input data-item="' + itemtype + '" class="sellbutton" type="submit" value="Sell"></input>' +
                                '</div>' +
                            '</div>'
                        );
                    }
                }
                if (npc.shop.trades) {
                    for (var i = 0; i < npc.shop.trades.length; i++) {
                        var itemtype = npc.shop.trades[i];
                        var shopitem = DV.Data.item_data[itemtype];
                        var quantity = player.items[itemtype] || 0;
                        $(".dialoguemenu .shop").append(
                            '<div class="shoprow">' +
                                '<div class="shopicon ' + shopitem.icon + '" data-itemid="' + itemtype + '" data-title="' + shopitem.title + '" data-desc="' + shopitem.description[0] + '">' + quantity + '</div>' +
                                '<div class="shopbuy">' +
                                    '<input class="' + itemtype + ' buyfield" data-item="' + itemtype + '" type="text" placeholder="' + shopitem.value*2 + ' Dust to buy. Enter quantity.">' +
                                    '<input data-item="' + itemtype + '" class="buybutton" type="submit" value="Buy"></input>' +
                                '</div>' +
                                '<div class="shopsell">' +
                                    '<input class="' + itemtype + ' sellfield" data-item="' + itemtype + '" type="text" placeholder="' + shopitem.value + ' Dust to sell. Enter quantity.">' +
                                    '<input data-item="' + itemtype + '" class="sellbutton" type="submit" value="Sell"></input>' +
                                '</div>' +
                            '</div>'
                        );
                    }
                }
            }
            for (var i = 0; i < npc.dialogue.length; i++) {
                var dialogue = npc.dialogue[i];
                $("#box4 .dialogueoptions").append(
                    '<div class = "dialogueoption" data-npc="' + npcId + '" data-response="' + i + '">' +
                    '<p>' + dialogue.input + '</p>' +
                    '</div>'
                );
            }
            
            $("#box4").append(
                '</div>' +
                '<div class = "dialogueresponse hidden">' +
                '<div class = "dialoguetext">' +
                '<p>This is some information</p>' +
                '<input id = "closeDialogue" class="openevent" type="submit" value="Ok"></input>' +
                '</div>' +
                '</div>' +
                '</div>'
            );
            switchTabs("tab4");
        }
    };
    
    function displayConvResponse(npcId, index) {
        var npc = null;
        for (var i = 0; i < area.npcs.length; i++) {
            if (area.npcs[i].id == npcId) {
                npc = area.npcs[i];
            }
        }
        if (npc) {
            var dOption = npc.dialogue[index];
            $("#box4 .dialoguetext p").empty();
            $("#box4 .dialoguetext p").append(dOption.output);
            $("#box4 .dialogueresponse").removeClass("hidden");
            $("#box4 .dialoguemenu").addClass("hidden");
        }
    };
    
    function getSuccessChance(event) {
        var quality = player.stats[event.stat];
        quality += getItemBonus(event.stat);
        var difficulty = event.difficulty;
        var result = 0.60*(quality/difficulty);
        if (result > 1) {
            result = 1;
        }
        return result;
    };
    
    function returnToConversation() {
        $("#box4 .dialogueresponse").addClass("hidden");
        $("#box4 .dialoguemenu").removeClass("hidden");
    };
    
    function displayInventory() {
        $("#box2").empty();
        var descToUse = player.description;
        if (player.trapped_desc) {
            descToUse = player.trapped_desc;
        }
        var invData = '<div class="profile">' +
            '<div class="profileicon playericon"></div>' +
            '<div class="furtherinfo">' +
            '<p>' + descToUse + '</p>' +
            '</div>' +
        '</div>' +
        '<div class="inventory">';
        
        invData += getInventorySlotData("head");
        invData += getInventorySlotData("clothes");
        invData += getInventorySlotData("weapon");
        invData += getInventorySlotData("feet");
        invData += getInventorySlotData("ally");
        
        var items = getAllItemsOfSlot(null);
        
        invData += '<div class="inventorybag">';
        for (var i = 0; i < items.length; i++) {
            var invitem = items[i];
            var itemdescription = "";
            if (invitem.quantity <= 0) {
                itemdescription = invitem.description[0];
            } else if (invitem.quantity > invitem.description.length) {
                itemdescription = invitem.description[invitem.description.length-1];
            } else {
                itemdescription = invitem.description[invitem.quantity-1];
            }
            invData += '<div data-title="' + invitem.title + '" data-desc="' + itemdescription + '" class="inventoryslot ' + invitem.icon + '">' + invitem.quantity + '</div>';
        }
        invData += '</div>';
        
        invData += '<div class="inventorybag">';
        var attributes = Object.keys(player.attributes);
        for (var i = 0; i < attributes.length; i++) {
            var att = attributes[i];
            var att_data = player.attributes[att];
            var invitem = DV.Data.item_data[att];

            if(att_data.value <= 0){
                // Skipping attributes less than 1
                continue;
            }

            var itemdescription = "";
            if (att_data.value > invitem.description.length || att_data.value <= 0) {
                itemdescription = invitem.description[0];
            } else {
                itemdescription = invitem.description[att_data.value-1];
            }

            invData += '<div data-itemid="' + att + '" data-title="' + invitem.title + '" data-desc="' + itemdescription + '" class="inventoryslot ' + invitem.icon + '">' + player.attributes[att].value + '</div>';
        }
        invData += '</div>';
        
        invData += '<div class="inventorybag">';
        if (player.suffering.pain.value > 0) {
            var invitem = DV.Data.item_data.pain;
            invData += '<div data-title="' + invitem.title + '" data-desc="' + invitem.description[0] + '" class="inventoryslot ' + invitem.icon + '">' + player.suffering.pain.value + '</div>';
        }
        if (player.suffering.guilt.value > 0) {
            var invitem = DV.Data.item_data.guilt;
            invData += '<div data-title="' + invitem.title + '" data-desc="' + invitem.description[0] + '" class="inventoryslot ' + invitem.icon + '">' + player.suffering.guilt.value + '</div>';
        }
        if (player.suffering.outcast.value > 0) {
            var invitem = DV.Data.item_data.outcast;
            invData += '<div data-title="' + invitem.title + '" data-desc="' + invitem.description[0] + '" class="inventoryslot ' + invitem.icon + '">' + player.suffering.outcast.value + '</div>';
        }
        if (player.suffering.curse.value > 0) {
            var invitem = DV.Data.item_data.curse;
            invData += '<div data-title="' + invitem.title + '" data-desc="' + invitem.description[0] + '" class="inventoryslot ' + invitem.icon + '">' + player.suffering.curse.value + '</div>';
        }
        invData += '</div>';
        
        invData += '</div>';
        
        $("#box2").append(invData);
    };
    
    function getInventorySlotData(slot) {
        var itemId = player.equipment[slot];
        var icon = '';
        var title = '';
        var desc = '';
        if (itemId && DV.Data.item_data[itemId]) {
            var item = DV.Data.item_data[itemId];
            icon = item.icon;
            title = item.title;
            desc = item.description[0];
        }
        var slotId = slot || '';
        var eqId = '';
        if (slot) {
            eqId = "equipment";
        }
        var items = getAllItemsOfSlot(slot);
        var result = '<div class="inventoryequip">' +
            '<div class="equipslot">' +
                '<div data-slot="' + slot + '" data-title = "' + title + '" data-desc = "' + desc + '" class="equipicon ' + icon + ' ' + slotId + '"></div>' +
                '<p class="equipdesc">' + capitalizeFirstLetter(slot) + '</p>' +
            '</div>' +
            '<div class="inventorybag">';
        for (var i = 0; i < items.length; i++) {
            var invitem = items[i];
            result += '<div data-itemid="' + invitem.itemId + '" data-slot="' + slot + '" data-title="' + invitem.title + '" data-desc="' + invitem.description[0] + '" class="' + eqId + ' inventoryslot ' + invitem.icon + '">' + invitem.quantity + '</div>';
        }
        result += '</div>' +
        '</div>';
        return result;
    };
    
    function getAllItemsOfSlot(slot) {
        var results = [];
        var itemKeys = Object.keys(player.items);
        for (var i = 0; i < itemKeys.length; i++) {
            var key = itemKeys[i];
            if (DV.Data.item_data[key] && ((DV.Data.item_data[key].slot == slot) || (DV.Data.item_data[key].slot == null && slot == null))) {
                var item_data = JSON.parse(JSON.stringify(DV.Data.item_data[key]));
                item_data.quantity = player.items[key];
                item_data.itemId = key;
                results.push(item_data);
            }
        }
        return results;
    };
    
    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    function displayArea(areaName) {
//        console.log(JSON.stringify(player));
        DV.Data.load_area(areaName,function(err,area_data){
            if(err){
                console.log(err);
                player.area = "dormaus_entrance";
                displayArea(data.area);
                return;
            }
            area = area_data;
            var areaEvents = global_area.events.concat(area.events);
            var freedomAvailable = false;
            for (var i = 0; i < area.events.length; i++) {
                var outcomesForEvent = Object.keys(area.events[i].results);
                for (var j = 0; j < outcomesForEvent.length; j++) {
                    var thisOutcome = area.events[i].results[outcomesForEvent[j]];
                    if (thisOutcome.freeTrap) {
                        freedomAvailable = true;
                    }
                }
            }
            if (!freedomAvailable && player.trapped) {
                areaEvents.push(fixStuckEvent);
            }
            $("#box1").empty();
            $("#box1").append(
                '<div class= "areadescriptor">' +
                '<h1>' + area.header +'</h1>' +
                '<h2>' + area.subheader +'</h2>' +
                '</div>'
            );
            $("#box1").append('<div class= "npclist">');
            for (var i = 0; i < area.npcs.length; i++) {
                var npc = area.npcs[i];
                $("#box1").append(
                    '<div id="' + npc.id +'" class="npc">' +
                    '<div class="npcicon ' + npc.icon + '"></div>' +
                    '<p class="npcname">' + npc.name + '</p>' +
                    '</div>'
                );
            }
            $("#box1").append('</div>');
            for (var i = 0; i < areaEvents.length; i++) {
                var event = areaEvents[i];
                if (isEventValid(event)) {
                    var chance = Math.floor(getSuccessChance(event)*100);
                    if (event.type != "statcheck") {
                        chance = 100;
                    }
                    if (eventValid(event, player)) {
                        newHtml = '<div class = "event">' +
                                '<div class="eventicon ' + event.icon + '"></div>' +
                                '<div class="eventbox">' +
                                    '<div class="eventdetails">' +
                                        '<p class="eventtitle">' + event.title + '</p>' +
                                        '<div class="eventconfirm"><div class="eventconfirmtext">' +
                                            '<p>' + event.subtitle + '</p></div>' +
                                            '<div class="eventbuttonholder">';
                        if (event.type == "statcheck") {
                            newHtml += '<p>' + chance + '%</p>' +
                                    '<div class="eventminiicon ' + event.stat + '"></div>';
                        }
                        newHtml += '<div class="okbuttonbox">' +
                            '<input data-event = "' + event.id +'" class="openevent" type="submit" value="Ok"></input>' +
                            '</div>' +
                            '</div>' +
                            '</div>' +
                            '</div>' +
                            '</div>' +
                            '</div>';
                        $("#box1").append(newHtml);
                    }
                }
            }
        });
    };
    
    displayArea(player.area);
    displayMap();
}