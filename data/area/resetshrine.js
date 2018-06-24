var area = {
        "title": "resetshrine",
        "header": "Temple of Memory",
        "subheader": 'This small shrine lies under the village church. It is a tiny room, lit by guttering candles, with a small statue and a basin of clear water. The statue is of a woman looking up into the sky, as if lost deep in thought. The walls of the shrine are covered in forget-me-nots.',
        "events": [
            {
                "id": "minor_reset",
                "title": "Touch the Water",
                "subtitle": "WARNING: THIS WILL PERMANENTLY REMOVE ALL OF YOUR QUEST ATTRIBUTES. You will keep only your gold, stat levels and items.",
                "type": "random", //or random
                "requirements": [
                ],
                "icon": "thevoid",
                "results": {
                    "success": { //success and fail, rare success, rare fail, or random
                        "text": "You touch your fingers gently to the water, and for a moment the entire world seems to turn on its axis. You stumble, and start to fall backwards. Just for a moment, you see the shrine around you illuminated by the sun, with marble statues and columns rising into the open sky. Then you catch yourself, and everything seems normal again. Your head is buzzing, and you can\'t quite remember how you got here. You only just reached this village, right? Time to go off and start your adventures!",
                        "reset": "minor",
                        "outcomes": []
                    }
                }
            },{
                "id": "major_reset",
                "title": "Drink the Water",
                "subtitle": 'WARNING WARNING WARNING: THIS WILL PERMANENTLY RESET YOUR CHARACTER. You will start fresh, as if you had just registered a new account.',
                "type": "random",
                "requirements": [
                ],
                "icon": "thevoid",
                "results": {
                    "mikhailsex": {
                        "text": 'You reach into the water, and for a moment the entire world seems to turn on its axis. You stumble, and start to fall, but you focus hard and cup the water in your hands even as your memories start to fall and fade away. You drink the water, feeling it flow down your throat, even as your mind falls and sinks into blank emptiness. Your body shifts, losing the strength and magic and skill you learned in this place, but also losing the scars. Your memories of meeting the people here wink out one by one, and you close your eyes. When you open them, you find yourself in a strange, mysterious fantasy world that you have never seen before.',
                        "reset": "major",
                        "area": "dormaus_entrance",
                        "outcomes": [
                        ]
                    }
                }
            }
        ],
        "npcs": [
            
        ]
    }