"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Smile, Search } from "lucide-react";
import { useEmojis } from "@/components/EmojiContext";

interface CustomEmoji {
  id: string;
  name: string;
  animated: boolean;
  url: string;
  guildId: string;
  guildName: string;
}

interface BotEmoji {
  id: string;
  name: string;
  animated: boolean;
}

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  buttonText?: string;
}

interface EmojiWithName {
  emoji: string;
  names: string[];
}

const unicodeEmojis: Record<string, EmojiWithName[]> = {
  "Emocje": [
    { emoji: "😀", names: ["grinning", "smile"] },
    { emoji: "😃", names: ["smiley", "smile", "happy"] },
    { emoji: "😄", names: ["smile", "happy", "joy"] },
    { emoji: "😁", names: ["grin", "happy"] },
    { emoji: "😆", names: ["laughing", "satisfied", "happy"] },
    { emoji: "😅", names: ["sweat_smile", "hot"] },
    { emoji: "🤣", names: ["rofl", "rolling", "laughing"] },
    { emoji: "😂", names: ["joy", "tears", "laughing"] },
    { emoji: "🙂", names: ["slightly_smiling_face", "smile"] },
    { emoji: "🙃", names: ["upside_down_face", "flip"] },
    { emoji: "😉", names: ["wink"] },
    { emoji: "😊", names: ["blush", "smile", "happy"] },
    { emoji: "😇", names: ["innocent", "angel"] },
    { emoji: "🥰", names: ["smiling_face_with_hearts", "love", "heart"] },
    { emoji: "😍", names: ["heart_eyes", "love", "crush"] },
    { emoji: "🤩", names: ["star_struck", "eyes", "star"] },
    { emoji: "😘", names: ["kissing_heart", "kiss", "love"] },
    { emoji: "😗", names: ["kissing"] },
    { emoji: "😚", names: ["kissing_closed_eyes"] },
    { emoji: "😙", names: ["kissing_smiling_eyes"] },
    { emoji: "🥲", names: ["smiling_face_with_tear"] },
    { emoji: "😋", names: ["yum", "tongue", "lick"] },
    { emoji: "😛", names: ["stuck_out_tongue"] },
    { emoji: "😜", names: ["stuck_out_tongue_winking_eye", "wink"] },
    { emoji: "🤪", names: ["zany_face", "crazy", "wild"] },
    { emoji: "😝", names: ["stuck_out_tongue_closed_eyes"] },
    { emoji: "🤑", names: ["money_mouth_face", "money", "rich"] },
    { emoji: "🤗", names: ["hugs", "hug"] },
    { emoji: "🤭", names: ["hand_over_mouth", "quiet", "shh"] },
    { emoji: "🤫", names: ["shushing_face", "quiet", "shh"] },
    { emoji: "🤔", names: ["thinking", "think"] },
    { emoji: "🤐", names: ["zipper_mouth_face", "quiet"] },
    { emoji: "🤨", names: ["raised_eyebrow", "suspicious"] },
    { emoji: "😐", names: ["neutral_face"] },
    { emoji: "😑", names: ["expressionless"] },
    { emoji: "😶", names: ["no_mouth", "silent"] },
    { emoji: "😏", names: ["smirk"] },
    { emoji: "😒", names: ["unamused"] },
    { emoji: "🙄", names: ["roll_eyes", "eyeroll"] },
    { emoji: "😬", names: ["grimacing"] },
    { emoji: "🤥", names: ["lying_face", "pinocchio", "lie"] },
    { emoji: "😌", names: ["relieved"] },
    { emoji: "😔", names: ["pensive", "sad"] },
    { emoji: "😪", names: ["sleepy", "tired"] },
    { emoji: "🤤", names: ["drooling_face", "drool"] },
    { emoji: "😴", names: ["sleeping", "sleep", "zzz"] },
    { emoji: "😷", names: ["mask", "sick", "ill"] },
    { emoji: "🤒", names: ["face_with_thermometer", "sick", "ill"] },
    { emoji: "🤕", names: ["face_with_head_bandage", "hurt", "injured"] },
    { emoji: "🤢", names: ["nauseated_face", "sick", "ill"] },
    { emoji: "🤮", names: ["vomiting_face", "sick", "puke"] },
    { emoji: "🤧", names: ["sneezing_face", "sick", "achoo"] },
    { emoji: "🥵", names: ["hot_face", "heat", "sweating"] },
    { emoji: "🥶", names: ["cold_face", "freezing", "ice"] },
    { emoji: "😵", names: ["dizzy_face", "confused"] },
    { emoji: "🤯", names: ["exploding_head", "mind_blown", "shocked"] },
    { emoji: "🤠", names: ["cowboy", "hat"] },
    { emoji: "🥳", names: ["partying_face", "party", "celebration"] },
    { emoji: "😎", names: ["sunglasses", "cool"] },
    { emoji: "🤓", names: ["nerd_face", "geek", "nerd"] },
    { emoji: "🧐", names: ["monocle_face", "thinking"] },
  ],
  "Gesty": [
    { emoji: "👍", names: ["thumbsup", "yes", "approve", "+1"] },
    { emoji: "👎", names: ["thumbsdown", "no", "disapprove", "-1"] },
    { emoji: "👌", names: ["ok_hand", "okay"] },
    { emoji: "✌️", names: ["v", "peace", "victory"] },
    { emoji: "🤞", names: ["crossed_fingers", "luck", "fingers_crossed"] },
    { emoji: "🤟", names: ["love_you_gesture", "ily"] },
    { emoji: "🤘", names: ["metal", "rock"] },
    { emoji: "🤙", names: ["call_me_hand", "phone"] },
    { emoji: "👈", names: ["point_left", "left"] },
    { emoji: "👉", names: ["point_right", "right"] },
    { emoji: "👆", names: ["point_up_2", "up"] },
    { emoji: "👇", names: ["point_down", "down"] },
    { emoji: "☝️", names: ["point_up", "index"] },
    { emoji: "👏", names: ["clap", "applause"] },
    { emoji: "🙌", names: ["raised_hands", "yay", "celebration"] },
    { emoji: "👐", names: ["open_hands"] },
    { emoji: "🤲", names: ["palms_up_together", "pray"] },
    { emoji: "🤝", names: ["handshake", "deal"] },
    { emoji: "🙏", names: ["pray", "please", "thanks", "namaste"] },
    { emoji: "✍️", names: ["writing_hand", "write"] },
    { emoji: "💪", names: ["muscle", "strong", "flex"] },
  ],
  "Serca": [
    { emoji: "❤️", names: ["heart", "love", "red_heart"] },
    { emoji: "🧡", names: ["orange_heart"] },
    { emoji: "💛", names: ["yellow_heart"] },
    { emoji: "💚", names: ["green_heart"] },
    { emoji: "💙", names: ["blue_heart"] },
    { emoji: "💜", names: ["purple_heart"] },
    { emoji: "🖤", names: ["black_heart"] },
    { emoji: "🤍", names: ["white_heart"] },
    { emoji: "🤎", names: ["brown_heart"] },
    { emoji: "💔", names: ["broken_heart", "heartbreak"] },
    { emoji: "💕", names: ["two_hearts", "love"] },
    { emoji: "💞", names: ["revolving_hearts", "love"] },
    { emoji: "💓", names: ["heartbeat", "love"] },
    { emoji: "💗", names: ["heartpulse", "love"] },
    { emoji: "💖", names: ["sparkling_heart", "love"] },
    { emoji: "💘", names: ["cupid", "love", "arrow"] },
    { emoji: "💝", names: ["gift_heart", "love", "valentine"] },
  ],
  "Zwierzęta": [
    { emoji: "🐶", names: ["dog", "puppy"] },
    { emoji: "🐱", names: ["cat", "kitty"] },
    { emoji: "🐭", names: ["mouse"] },
    { emoji: "🐹", names: ["hamster"] },
    { emoji: "🐰", names: ["rabbit", "bunny"] },
    { emoji: "🦊", names: ["fox"] },
    { emoji: "🐻", names: ["bear"] },
    { emoji: "🐼", names: ["panda"] },
    { emoji: "🐨", names: ["koala"] },
    { emoji: "🐯", names: ["tiger"] },
    { emoji: "🦁", names: ["lion"] },
    { emoji: "🐮", names: ["cow"] },
    { emoji: "🐷", names: ["pig"] },
    { emoji: "🐸", names: ["frog"] },
    { emoji: "🐵", names: ["monkey"] },
    { emoji: "🐔", names: ["chicken"] },
    { emoji: "🐧", names: ["penguin"] },
    { emoji: "🐦", names: ["bird"] },
    { emoji: "🐤", names: ["baby_chick"] },
    { emoji: "🦆", names: ["duck"] },
    { emoji: "🦅", names: ["eagle"] },
    { emoji: "🦉", names: ["owl"] },
    { emoji: "🦇", names: ["bat"] },
    { emoji: "🐺", names: ["wolf"] },
    { emoji: "🐗", names: ["boar"] },
    { emoji: "🐴", names: ["horse"] },
    { emoji: "🦄", names: ["unicorn"] },
    { emoji: "🐝", names: ["bee", "honeybee"] },
    { emoji: "🐛", names: ["bug", "caterpillar"] },
    { emoji: "🦋", names: ["butterfly"] },
    { emoji: "🐌", names: ["snail"] },
    { emoji: "🐞", names: ["ladybug", "beetle"] },
    { emoji: "🐜", names: ["ant"] },
    { emoji: "🐢", names: ["turtle"] },
    { emoji: "🐍", names: ["snake"] },
    { emoji: "🦎", names: ["lizard"] },
    { emoji: "🦖", names: ["t-rex", "dinosaur"] },
    { emoji: "🦕", names: ["sauropod", "dinosaur"] },
    { emoji: "🐙", names: ["octopus"] },
    { emoji: "🦑", names: ["squid"] },
    { emoji: "🦐", names: ["shrimp"] },
    { emoji: "🦞", names: ["lobster"] },
    { emoji: "🦀", names: ["crab"] },
    { emoji: "🐡", names: ["blowfish"] },
    { emoji: "🐠", names: ["tropical_fish"] },
    { emoji: "🐟", names: ["fish"] },
    { emoji: "🐬", names: ["dolphin"] },
    { emoji: "🐳", names: ["whale"] },
    { emoji: "🐋", names: ["whale2"] },
    { emoji: "🦈", names: ["shark"] },
    { emoji: "🐊", names: ["crocodile"] },
    { emoji: "🐅", names: ["tiger2"] },
    { emoji: "🐆", names: ["leopard"] },
    { emoji: "🦓", names: ["zebra"] },
    { emoji: "🦍", names: ["gorilla"] },
    { emoji: "🦧", names: ["orangutan"] },
    { emoji: "🐘", names: ["elephant"] },
    { emoji: "🦛", names: ["hippopotamus"] },
    { emoji: "🦏", names: ["rhinoceros"] },
    { emoji: "🐪", names: ["camel"] },
    { emoji: "🐫", names: ["two_hump_camel"] },
    { emoji: "🦒", names: ["giraffe"] },
    { emoji: "🦘", names: ["kangaroo"] },
    { emoji: "🐃", names: ["water_buffalo"] },
    { emoji: "🐂", names: ["ox"] },
    { emoji: "🐄", names: ["cow2"] },
    { emoji: "🐎", names: ["racehorse", "horse"] },
    { emoji: "🐖", names: ["pig2"] },
    { emoji: "🐏", names: ["ram"] },
    { emoji: "🐑", names: ["sheep"] },
    { emoji: "🦙", names: ["llama"] },
    { emoji: "🐐", names: ["goat"] },
    { emoji: "🦌", names: ["deer"] },
    { emoji: "🐕", names: ["dog2"] },
    { emoji: "🐩", names: ["poodle"] },
    { emoji: "🐈", names: ["cat2"] },
    { emoji: "🐓", names: ["rooster"] },
    { emoji: "🦃", names: ["turkey"] },
    { emoji: "🦚", names: ["peacock"] },
    { emoji: "🦜", names: ["parrot"] },
    { emoji: "🦢", names: ["swan"] },
    { emoji: "🦩", names: ["flamingo"] },
    { emoji: "🕊️", names: ["dove", "peace"] },
    { emoji: "🐇", names: ["rabbit2"] },
    { emoji: "🦝", names: ["raccoon"] },
    { emoji: "🦨", names: ["skunk"] },
    { emoji: "🦡", names: ["badger"] },
    { emoji: "🦦", names: ["otter"] },
    { emoji: "🦥", names: ["sloth"] },
    { emoji: "🐁", names: ["mouse2"] },
    { emoji: "🐀", names: ["rat"] },
    { emoji: "🐿️", names: ["chipmunk"] },
    { emoji: "🦔", names: ["hedgehog"] },
  ],
  "Jedzenie": [
    { emoji: "🍎", names: ["apple", "red_apple"] },
    { emoji: "🍊", names: ["orange", "tangerine"] },
    { emoji: "🍋", names: ["lemon"] },
    { emoji: "🍌", names: ["banana"] },
    { emoji: "🍉", names: ["watermelon"] },
    { emoji: "🍇", names: ["grapes"] },
    { emoji: "🍓", names: ["strawberry"] },
    { emoji: "🍈", names: ["melon"] },
    { emoji: "🍒", names: ["cherries", "cherry"] },
    { emoji: "🍑", names: ["peach"] },
    { emoji: "🥭", names: ["mango"] },
    { emoji: "🍍", names: ["pineapple"] },
    { emoji: "🥥", names: ["coconut"] },
    { emoji: "🥝", names: ["kiwi"] },
    { emoji: "🍅", names: ["tomato"] },
    { emoji: "🍆", names: ["eggplant"] },
    { emoji: "🥑", names: ["avocado"] },
    { emoji: "🥦", names: ["broccoli"] },
    { emoji: "🥬", names: ["leafy_green"] },
    { emoji: "🥒", names: ["cucumber", "pickle"] },
    { emoji: "🌶️", names: ["hot_pepper", "chili"] },
    { emoji: "🌽", names: ["corn"] },
    { emoji: "🥕", names: ["carrot"] },
    { emoji: "🧄", names: ["garlic"] },
    { emoji: "🧅", names: ["onion"] },
    { emoji: "🥔", names: ["potato"] },
    { emoji: "🍠", names: ["sweet_potato"] },
    { emoji: "🥐", names: ["croissant"] },
    { emoji: "🥯", names: ["bagel"] },
    { emoji: "🍞", names: ["bread"] },
    { emoji: "🥖", names: ["baguette"] },
    { emoji: "🥨", names: ["pretzel"] },
    { emoji: "🧀", names: ["cheese"] },
    { emoji: "🥚", names: ["egg"] },
    { emoji: "🍳", names: ["cooking", "fried_egg"] },
    { emoji: "🥞", names: ["pancakes"] },
    { emoji: "🧇", names: ["waffle"] },
    { emoji: "🥓", names: ["bacon"] },
    { emoji: "🥩", names: ["steak", "meat"] },
    { emoji: "🍗", names: ["poultry_leg", "chicken"] },
    { emoji: "🍖", names: ["meat_on_bone"] },
    { emoji: "🌭", names: ["hotdog", "hot_dog"] },
    { emoji: "🍔", names: ["hamburger", "burger"] },
    { emoji: "🍟", names: ["fries", "french_fries"] },
    { emoji: "🍕", names: ["pizza"] },
    { emoji: "🥪", names: ["sandwich"] },
    { emoji: "🥙", names: ["stuffed_flatbread"] },
    { emoji: "🧆", names: ["falafel"] },
    { emoji: "🌮", names: ["taco"] },
    { emoji: "🌯", names: ["burrito"] },
    { emoji: "🥗", names: ["green_salad", "salad"] },
    { emoji: "🥘", names: ["shallow_pan_of_food", "paella"] },
    { emoji: "🥫", names: ["canned_food"] },
    { emoji: "🍝", names: ["spaghetti", "pasta"] },
    { emoji: "🍜", names: ["ramen"] },
    { emoji: "🍲", names: ["stew"] },
    { emoji: "🍛", names: ["curry"] },
    { emoji: "🍣", names: ["sushi"] },
    { emoji: "🍱", names: ["bento"] },
    { emoji: "🥟", names: ["dumpling"] },
    { emoji: "🦪", names: ["oyster"] },
    { emoji: "🍤", names: ["fried_shrimp"] },
    { emoji: "🍙", names: ["rice_ball"] },
    { emoji: "🍚", names: ["rice"] },
    { emoji: "🍘", names: ["rice_cracker"] },
    { emoji: "🍥", names: ["fish_cake"] },
    { emoji: "🥠", names: ["fortune_cookie"] },
    { emoji: "🥮", names: ["moon_cake"] },
    { emoji: "🍢", names: ["oden"] },
    { emoji: "🍡", names: ["dango"] },
    { emoji: "🍧", names: ["shaved_ice"] },
    { emoji: "🍨", names: ["ice_cream"] },
    { emoji: "🍦", names: ["icecream", "soft_ice_cream"] },
    { emoji: "🥧", names: ["pie"] },
    { emoji: "🧁", names: ["cupcake"] },
    { emoji: "🍰", names: ["cake", "shortcake"] },
    { emoji: "🎂", names: ["birthday", "cake"] },
    { emoji: "🍮", names: ["custard", "pudding", "flan"] },
    { emoji: "🍭", names: ["lollipop"] },
    { emoji: "🍬", names: ["candy"] },
    { emoji: "🍫", names: ["chocolate_bar"] },
    { emoji: "🍿", names: ["popcorn"] },
    { emoji: "🍩", names: ["doughnut", "donut"] },
    { emoji: "🍪", names: ["cookie"] },
    { emoji: "🌰", names: ["chestnut"] },
    { emoji: "🥜", names: ["peanuts"] },
    { emoji: "🍯", names: ["honey_pot", "honey"] },
  ],
  "Aktywności": [
    { emoji: "⚽", names: ["soccer", "football"] },
    { emoji: "🏀", names: ["basketball"] },
    { emoji: "🏈", names: ["football", "american_football"] },
    { emoji: "⚾", names: ["baseball"] },
    { emoji: "🥎", names: ["softball"] },
    { emoji: "🎾", names: ["tennis"] },
    { emoji: "🏐", names: ["volleyball"] },
    { emoji: "🏉", names: ["rugby_football"] },
    { emoji: "🥏", names: ["flying_disc", "frisbee"] },
    { emoji: "🎱", names: ["8ball", "billiards"] },
    { emoji: "🏓", names: ["ping_pong", "table_tennis"] },
    { emoji: "🏸", names: ["badminton"] },
    { emoji: "🏒", names: ["ice_hockey"] },
    { emoji: "🏑", names: ["field_hockey"] },
    { emoji: "🥍", names: ["lacrosse"] },
    { emoji: "🏏", names: ["cricket"] },
    { emoji: "🥅", names: ["goal_net"] },
    { emoji: "⛳", names: ["golf"] },
    { emoji: "🏹", names: ["bow_and_arrow", "archery"] },
    { emoji: "🎣", names: ["fishing_pole_and_fish"] },
    { emoji: "🥊", names: ["boxing_glove"] },
    { emoji: "🥋", names: ["martial_arts_uniform"] },
    { emoji: "🎽", names: ["running_shirt_with_sash"] },
    { emoji: "🛹", names: ["skateboard"] },
    { emoji: "🛷", names: ["sled"] },
    { emoji: "⛸️", names: ["ice_skate"] },
    { emoji: "🥌", names: ["curling_stone"] },
    { emoji: "🎿", names: ["ski"] },
    { emoji: "⛷️", names: ["skier"] },
    { emoji: "🏂", names: ["snowboarder", "snowboard"] },
    { emoji: "🏋️", names: ["weight_lifter", "lifting"] },
    { emoji: "🤼", names: ["wrestlers", "wrestling"] },
    { emoji: "🤸", names: ["person_cartwheeling"] },
    { emoji: "🤺", names: ["person_fencing", "fencing"] },
    { emoji: "⛹️", names: ["person_bouncing_ball", "basketball_player"] },
    { emoji: "🤾", names: ["person_playing_handball"] },
    { emoji: "🏌️", names: ["person_golfing", "golfer"] },
    { emoji: "🏇", names: ["horse_racing"] },
    { emoji: "🧘", names: ["person_in_lotus_position", "yoga"] },
    { emoji: "🏊", names: ["swimmer", "swimming"] },
    { emoji: "🚴", names: ["bicyclist", "cycling"] },
    { emoji: "🚵", names: ["mountain_bicyclist"] },
    { emoji: "🧗", names: ["person_climbing", "climbing"] },
    { emoji: "🤹", names: ["person_juggling", "juggling"] },
  ],
  "Podróże": [
    { emoji: "🚗", names: ["car", "red_car"] },
    { emoji: "🚕", names: ["taxi"] },
    { emoji: "🚙", names: ["blue_car"] },
    { emoji: "🚌", names: ["bus"] },
    { emoji: "🚎", names: ["trolleybus"] },
    { emoji: "🏎️", names: ["racing_car"] },
    { emoji: "🚓", names: ["police_car"] },
    { emoji: "🚑", names: ["ambulance"] },
    { emoji: "🚒", names: ["fire_engine"] },
    { emoji: "🚐", names: ["minibus"] },
    { emoji: "🚚", names: ["truck"] },
    { emoji: "🚛", names: ["articulated_lorry"] },
    { emoji: "🚜", names: ["tractor"] },
    { emoji: "🚲", names: ["bike", "bicycle"] },
    { emoji: "🛵", names: ["motor_scooter"] },
    { emoji: "🏍️", names: ["motorcycle", "racing_motorcycle"] },
    { emoji: "🚨", names: ["rotating_light", "siren"] },
    { emoji: "🚔", names: ["oncoming_police_car"] },
    { emoji: "🚍", names: ["oncoming_bus"] },
    { emoji: "🚘", names: ["oncoming_automobile"] },
    { emoji: "🚖", names: ["oncoming_taxi"] },
    { emoji: "🚡", names: ["aerial_tramway"] },
    { emoji: "🚠", names: ["mountain_cableway"] },
    { emoji: "🚟", names: ["suspension_railway"] },
    { emoji: "🚃", names: ["railway_car"] },
    { emoji: "🚋", names: ["train"] },
    { emoji: "🚞", names: ["mountain_railway"] },
    { emoji: "🚝", names: ["monorail"] },
    { emoji: "🚄", names: ["bullettrain_side"] },
    { emoji: "🚅", names: ["bullettrain_front"] },
    { emoji: "🚈", names: ["light_rail"] },
    { emoji: "🚂", names: ["steam_locomotive"] },
    { emoji: "🚆", names: ["train2"] },
    { emoji: "🚇", names: ["metro"] },
    { emoji: "🚊", names: ["tram"] },
    { emoji: "🚉", names: ["station"] },
    { emoji: "✈️", names: ["airplane", "plane"] },
    { emoji: "🛫", names: ["airplane_departure"] },
    { emoji: "🛬", names: ["airplane_arriving"] },
    { emoji: "🛩️", names: ["small_airplane"] },
    { emoji: "💺", names: ["seat"] },
    { emoji: "🛰️", names: ["satellite"] },
    { emoji: "🚀", names: ["rocket"] },
    { emoji: "🛸", names: ["flying_saucer", "ufo"] },
    { emoji: "🚁", names: ["helicopter"] },
    { emoji: "🛶", names: ["canoe"] },
    { emoji: "⛵", names: ["boat", "sailboat"] },
    { emoji: "🚤", names: ["speedboat"] },
    { emoji: "🛥️", names: ["motor_boat"] },
    { emoji: "🛳️", names: ["passenger_ship"] },
    { emoji: "⛴️", names: ["ferry"] },
    { emoji: "🚢", names: ["ship"] },
    { emoji: "⚓", names: ["anchor"] },
  ],
  "Muzyka": [
    { emoji: "🔇", names: ["mute", "speaker_off"] },
    { emoji: "🔈", names: ["speaker", "volume_low"] },
    { emoji: "🔉", names: ["sound", "volume_medium"] },
    { emoji: "🔊", names: ["loud_sound", "volume_high", "speaker"] },
    { emoji: "📢", names: ["loudspeaker"] },
    { emoji: "📣", names: ["mega", "megaphone"] },
    { emoji: "📯", names: ["postal_horn"] },
    { emoji: "🔔", names: ["bell"] },
    { emoji: "🔕", names: ["no_bell", "bell_slash"] },
    { emoji: "🎼", names: ["musical_score"] },
    { emoji: "🎵", names: ["musical_note"] },
    { emoji: "🎶", names: ["notes", "musical_notes"] },
    { emoji: "🎤", names: ["microphone"] },
    { emoji: "🎧", names: ["headphones"] },
    { emoji: "🎷", names: ["saxophone"] },
    { emoji: "🎸", names: ["guitar"] },
    { emoji: "🎹", names: ["musical_keyboard", "piano"] },
    { emoji: "🎺", names: ["trumpet"] },
    { emoji: "🎻", names: ["violin"] },
    { emoji: "🥁", names: ["drum", "drumsticks"] },
    { emoji: "🪕", names: ["banjo"] },
    { emoji: "🪘", names: ["long_drum"] },
    { emoji: "🎬", names: ["clapper", "clapper_board"] },
    { emoji: "🎭", names: ["performing_arts", "masks"] },
  ],
  "Święta": [
    { emoji: "🎃", names: ["jack_o_lantern", "halloween"] },
    { emoji: "🎄", names: ["christmas_tree"] },
    { emoji: "🎆", names: ["fireworks"] },
    { emoji: "🎇", names: ["sparkler"] },
    { emoji: "🧨", names: ["firecracker"] },
    { emoji: "✨", names: ["sparkles"] },
    { emoji: "🎈", names: ["balloon"] },
    { emoji: "🎉", names: ["tada", "party"] },
    { emoji: "🎊", names: ["confetti_ball"] },
    { emoji: "🎋", names: ["tanabata_tree"] },
    { emoji: "🎍", names: ["bamboo"] },
    { emoji: "🎎", names: ["dolls"] },
    { emoji: "🎏", names: ["flags", "carp_streamers"] },
    { emoji: "🎐", names: ["wind_chime"] },
    { emoji: "🎑", names: ["rice_scene", "moon_ceremony"] },
    { emoji: "🧧", names: ["red_envelope"] },
    { emoji: "🎀", names: ["ribbon"] },
    { emoji: "🎁", names: ["gift", "present"] },
    { emoji: "🎗️", names: ["reminder_ribbon"] },
    { emoji: "🎟️", names: ["admission_tickets"] },
    { emoji: "🎫", names: ["ticket"] },
  ],
  "Gry": [
    { emoji: "🎮", names: ["video_game"] },
    { emoji: "🕹️", names: ["joystick"] },
    { emoji: "🎰", names: ["slot_machine"] },
    { emoji: "🎲", names: ["game_die", "dice"] },
    { emoji: "🧩", names: ["jigsaw", "puzzle_piece"] },
    { emoji: "🧸", names: ["teddy_bear"] },
    { emoji: "🪅", names: ["pinata"] },
    { emoji: "🪆", names: ["nesting_dolls"] },
    { emoji: "♠️", names: ["spades"] },
    { emoji: "♥️", names: ["hearts"] },
    { emoji: "♦️", names: ["diamonds"] },
    { emoji: "♣️", names: ["clubs"] },
    { emoji: "♟️", names: ["chess_pawn"] },
    { emoji: "🃏", names: ["black_joker"] },
    { emoji: "🀄", names: ["mahjong"] },
    { emoji: "🎴", names: ["flower_playing_cards"] },
  ],
  "Narzędzia": [
    { emoji: "🔨", names: ["hammer"] },
    { emoji: "🪓", names: ["axe"] },
    { emoji: "⛏️", names: ["pick", "pickaxe"] },
    { emoji: "⚒️", names: ["hammer_and_pick"] },
    { emoji: "🛠️", names: ["hammer_and_wrench", "tools"] },
    { emoji: "🗡️", names: ["dagger", "knife"] },
    { emoji: "⚔️", names: ["crossed_swords"] },
    { emoji: "🔫", names: ["gun", "water_pistol"] },
    { emoji: "🪃", names: ["boomerang"] },
    { emoji: "🏹", names: ["bow_and_arrow"] },
    { emoji: "🛡️", names: ["shield"] },
    { emoji: "🪚", names: ["carpentry_saw"] },
    { emoji: "🔧", names: ["wrench"] },
    { emoji: "🪛", names: ["screwdriver"] },
    { emoji: "🔩", names: ["nut_and_bolt"] },
    { emoji: "⚙️", names: ["gear"] },
    { emoji: "🗜️", names: ["compression"] },
    { emoji: "⚖️", names: ["scales", "balance_scale"] },
    { emoji: "🦯", names: ["probing_cane"] },
    { emoji: "🔗", names: ["link"] },
    { emoji: "⛓️", names: ["chains"] },
    { emoji: "🪝", names: ["hook"] },
    { emoji: "🧰", names: ["toolbox"] },
    { emoji: "🧲", names: ["magnet"] },
    { emoji: "🪜", names: ["ladder"] },
  ],
  "Medyczne": [
    { emoji: "⚕️", names: ["medical_symbol"] },
    { emoji: "💊", names: ["pill"] },
    { emoji: "💉", names: ["syringe"] },
    { emoji: "🩸", names: ["drop_of_blood"] },
    { emoji: "🩹", names: ["adhesive_bandage"] },
    { emoji: "🩺", names: ["stethoscope"] },
    { emoji: "🩻", names: ["x_ray"] },
    { emoji: "🧬", names: ["dna"] },
    { emoji: "🔬", names: ["microscope"] },
    { emoji: "🔭", names: ["telescope"] },
  ],
  "Biuro": [
    { emoji: "📝", names: ["memo", "pencil"] },
    { emoji: "📄", names: ["page_facing_up"] },
    { emoji: "📃", names: ["page_with_curl"] },
    { emoji: "📑", names: ["bookmark_tabs"] },
    { emoji: "📊", names: ["bar_chart"] },
    { emoji: "📈", names: ["chart_with_upwards_trend"] },
    { emoji: "📉", names: ["chart_with_downwards_trend"] },
    { emoji: "📆", names: ["calendar"] },
    { emoji: "📅", names: ["date"] },
    { emoji: "📇", names: ["card_index"] },
    { emoji: "🗂️", names: ["card_file_box"] },
    { emoji: "🗃️", names: ["card_index_dividers"] },
    { emoji: "🗄️", names: ["file_cabinet"] },
    { emoji: "📋", names: ["clipboard"] },
    { emoji: "📁", names: ["file_folder"] },
    { emoji: "📂", names: ["open_file_folder"] },
    { emoji: "🗒️", names: ["spiral_note_pad"] },
    { emoji: "🗓️", names: ["spiral_calendar_pad"] },
    { emoji: "📌", names: ["pushpin"] },
    { emoji: "📍", names: ["round_pushpin"] },
    { emoji: "✂️", names: ["scissors"] },
    { emoji: "🖇️", names: ["linked_paperclips"] },
    { emoji: "📎", names: ["paperclip"] },
    { emoji: "🖊️", names: ["lower_left_ballpoint_pen"] },
    { emoji: "🖋️", names: ["lower_left_fountain_pen"] },
    { emoji: "✒️", names: ["black_nib"] },
    { emoji: "✏️", names: ["pencil2"] },
    { emoji: "📏", names: ["straight_ruler"] },
    { emoji: "📐", names: ["triangular_ruler"] },
  ],
  "Książki": [
    { emoji: "📕", names: ["closed_book"] },
    { emoji: "📗", names: ["green_book"] },
    { emoji: "📘", names: ["blue_book"] },
    { emoji: "📙", names: ["orange_book"] },
    { emoji: "📔", names: ["notebook_with_decorative_cover"] },
    { emoji: "📓", names: ["notebook"] },
    { emoji: "📒", names: ["ledger"] },
    { emoji: "📚", names: ["books"] },
    { emoji: "📖", names: ["book", "open_book"] },
    { emoji: "🔖", names: ["bookmark"] },
    { emoji: "📰", names: ["newspaper"] },
    { emoji: "🗞️", names: ["rolled_up_newspaper"] },
    { emoji: "📜", names: ["scroll"] },
  ],
  "Poczta": [
    { emoji: "✉️", names: ["envelope"] },
    { emoji: "📧", names: ["e-mail", "email"] },
    { emoji: "📨", names: ["incoming_envelope"] },
    { emoji: "📩", names: ["envelope_with_arrow"] },
    { emoji: "📤", names: ["outbox_tray"] },
    { emoji: "📥", names: ["inbox_tray"] },
    { emoji: "📦", names: ["package"] },
    { emoji: "📫", names: ["mailbox"] },
    { emoji: "📪", names: ["mailbox_closed"] },
    { emoji: "📬", names: ["mailbox_with_mail"] },
    { emoji: "📭", names: ["mailbox_with_no_mail"] },
    { emoji: "📮", names: ["postbox"] },
    { emoji: "🗳️", names: ["ballot_box_with_ballot"] },
  ],
  "Zamki": [
    { emoji: "🔐", names: ["closed_lock_with_key"] },
    { emoji: "🔒", names: ["lock", "closed_lock"] },
    { emoji: "🔓", names: ["unlock", "open_lock"] },
    { emoji: "🔏", names: ["lock_with_ink_pen"] },
    { emoji: "🔑", names: ["key"] },
    { emoji: "🗝️", names: ["old_key"] },
  ],
  "Ubrania": [
    { emoji: "👔", names: ["necktie"] },
    { emoji: "👕", names: ["shirt", "tshirt"] },
    { emoji: "👖", names: ["jeans"] },
    { emoji: "🧣", names: ["scarf"] },
    { emoji: "🧤", names: ["gloves"] },
    { emoji: "🧥", names: ["coat"] },
    { emoji: "🧦", names: ["socks"] },
    { emoji: "👗", names: ["dress"] },
    { emoji: "👘", names: ["kimono"] },
    { emoji: "🥻", names: ["sari"] },
    { emoji: "🩱", names: ["one_piece_swimsuit"] },
    { emoji: "🩲", names: ["swim_brief"] },
    { emoji: "🩳", names: ["shorts"] },
    { emoji: "👙", names: ["bikini"] },
    { emoji: "👚", names: ["womans_clothes"] },
    { emoji: "👛", names: ["purse"] },
    { emoji: "👜", names: ["handbag"] },
    { emoji: "👝", names: ["pouch"] },
    { emoji: "🎒", names: ["school_satchel", "backpack"] },
    { emoji: "🩴", names: ["thong_sandal"] },
    { emoji: "👞", names: ["mans_shoe", "shoe"] },
    { emoji: "👟", names: ["athletic_shoe", "sneaker"] },
    { emoji: "🥾", names: ["hiking_boot"] },
    { emoji: "🥿", names: ["flat_shoe"] },
    { emoji: "👠", names: ["high_heel"] },
    { emoji: "👡", names: ["sandal"] },
    { emoji: "🩰", names: ["ballet_shoes"] },
    { emoji: "👢", names: ["boot"] },
    { emoji: "👑", names: ["crown"] },
    { emoji: "👒", names: ["womans_hat"] },
    { emoji: "🎩", names: ["tophat"] },
    { emoji: "🎓", names: ["mortar_board", "graduation_cap"] },
    { emoji: "🧢", names: ["billed_cap"] },
    { emoji: "🪖", names: ["military_helmet"] },
    { emoji: "⛑️", names: ["helmet_with_white_cross"] },
    { emoji: "📿", names: ["prayer_beads"] },
    { emoji: "💄", names: ["lipstick"] },
    { emoji: "💍", names: ["ring"] },
    { emoji: "💎", names: ["gem", "diamond"] },
  ],
  "Obiekty": [
    { emoji: "⌚", names: ["watch"] },
    { emoji: "📱", names: ["iphone", "phone", "mobile"] },
    { emoji: "📲", names: ["calling"] },
    { emoji: "💻", names: ["computer", "laptop"] },
    { emoji: "⌨️", names: ["keyboard"] },
    { emoji: "🖥️", names: ["desktop_computer"] },
    { emoji: "🖨️", names: ["printer"] },
    { emoji: "🖱️", names: ["computer_mouse"] },
    { emoji: "🖲️", names: ["trackball"] },
    { emoji: "🕹️", names: ["joystick"] },
    { emoji: "💾", names: ["floppy_disk"] },
    { emoji: "💿", names: ["cd"] },
    { emoji: "📀", names: ["dvd"] },
    { emoji: "📼", names: ["vhs"] },
    { emoji: "📷", names: ["camera"] },
    { emoji: "📸", names: ["camera_with_flash"] },
    { emoji: "📹", names: ["video_camera"] },
    { emoji: "🎥", names: ["movie_camera"] },
    { emoji: "📽️", names: ["film_projector"] },
    { emoji: "🎞️", names: ["film_frames"] },
    { emoji: "📞", names: ["telephone_receiver"] },
    { emoji: "☎️", names: ["phone", "telephone"] },
    { emoji: "📟", names: ["pager"] },
    { emoji: "📠", names: ["fax"] },
    { emoji: "📺", names: ["tv", "television"] },
    { emoji: "📻", names: ["radio"] },
    { emoji: "🎙️", names: ["studio_microphone"] },
    { emoji: "🎚️", names: ["level_slider"] },
    { emoji: "🎛️", names: ["control_knobs"] },
    { emoji: "⏱️", names: ["stopwatch"] },
    { emoji: "⏲️", names: ["timer_clock"] },
    { emoji: "⏰", names: ["alarm_clock"] },
    { emoji: "🕰️", names: ["mantelpiece_clock"] },
    { emoji: "⌛", names: ["hourglass"] },
    { emoji: "⏳", names: ["hourglass_flowing_sand"] },
    { emoji: "📡", names: ["satellite_antenna"] },
    { emoji: "🔋", names: ["battery"] },
    { emoji: "🔌", names: ["electric_plug"] },
    { emoji: "💡", names: ["bulb", "light_bulb"] },
    { emoji: "🔦", names: ["flashlight"] },
    { emoji: "🕯️", names: ["candle"] },
    { emoji: "🧯", names: ["fire_extinguisher"] },
    { emoji: "🛢️", names: ["oil_drum"] },
    { emoji: "💸", names: ["money_with_wings"] },
    { emoji: "💵", names: ["dollar"] },
    { emoji: "💴", names: ["yen"] },
    { emoji: "💶", names: ["euro"] },
    { emoji: "💷", names: ["pound"] },
    { emoji: "💰", names: ["moneybag"] },
    { emoji: "💳", names: ["credit_card"] },
    { emoji: "🪙", names: ["coin"] },
    { emoji: "💎", names: ["gem"] },
  ],
  "Symbole": [
    { emoji: "❤️", names: ["heart", "love", "red_heart"] },
    { emoji: "🧡", names: ["orange_heart"] },
    { emoji: "💛", names: ["yellow_heart"] },
    { emoji: "💚", names: ["green_heart"] },
    { emoji: "💙", names: ["blue_heart"] },
    { emoji: "💜", names: ["purple_heart"] },
    { emoji: "🖤", names: ["black_heart"] },
    { emoji: "🤍", names: ["white_heart"] },
    { emoji: "🤎", names: ["brown_heart"] },
    { emoji: "💔", names: ["broken_heart"] },
    { emoji: "❣️", names: ["heavy_heart_exclamation"] },
    { emoji: "💕", names: ["two_hearts"] },
    { emoji: "💞", names: ["revolving_hearts"] },
    { emoji: "💓", names: ["heartbeat"] },
    { emoji: "💗", names: ["heartpulse"] },
    { emoji: "💖", names: ["sparkling_heart"] },
    { emoji: "💘", names: ["cupid"] },
    { emoji: "💝", names: ["gift_heart"] },
    { emoji: "✝️", names: ["latin_cross", "cross"] },
    { emoji: "☪️", names: ["star_and_crescent"] },
    { emoji: "🕉️", names: ["om"] },
    { emoji: "☸️", names: ["wheel_of_dharma"] },
    { emoji: "✡️", names: ["star_of_david"] },
    { emoji: "🔯", names: ["six_pointed_star"] },
    { emoji: "☯️", names: ["yin_yang"] },
    { emoji: "⛎", names: ["ophiuchus"] },
    { emoji: "♈", names: ["aries"] },
    { emoji: "♉", names: ["taurus"] },
    { emoji: "♊", names: ["gemini"] },
    { emoji: "♋", names: ["cancer"] },
    { emoji: "♌", names: ["leo"] },
    { emoji: "♍", names: ["virgo"] },
    { emoji: "♎", names: ["libra"] },
    { emoji: "♏", names: ["scorpius"] },
    { emoji: "♐", names: ["sagittarius"] },
    { emoji: "♑", names: ["capricorn"] },
    { emoji: "♒", names: ["aquarius"] },
    { emoji: "♓", names: ["pisces"] },
    { emoji: "🆔", names: ["id"] },
    { emoji: "⚛️", names: ["atom_symbol"] },
    { emoji: "☢️", names: ["radioactive"] },
    { emoji: "☣️", names: ["biohazard"] },
    { emoji: "📴", names: ["mobile_phone_off"] },
    { emoji: "📳", names: ["vibration_mode"] },
    { emoji: "🆚", names: ["vs"] },
    { emoji: "🅰️", names: ["a", "letter_a"] },
    { emoji: "🅱️", names: ["b", "letter_b"] },
    { emoji: "🆎", names: ["ab"] },
    { emoji: "🆑", names: ["cl"] },
    { emoji: "🅾️", names: ["o2"] },
    { emoji: "🆘", names: ["sos"] },
    { emoji: "❌", names: ["x"] },
    { emoji: "⭕", names: ["o"] },
    { emoji: "🛑", names: ["stop_sign"] },
    { emoji: "⛔", names: ["no_entry"] },
    { emoji: "📛", names: ["name_badge"] },
    { emoji: "🚫", names: ["no_entry_sign"] },
    { emoji: "💯", names: ["100"] },
    { emoji: "💢", names: ["anger"] },
    { emoji: "♨️", names: ["hotsprings"] },
    { emoji: "🚷", names: ["no_pedestrians"] },
    { emoji: "🚯", names: ["do_not_litter"] },
    { emoji: "🚳", names: ["no_bicycles"] },
    { emoji: "🚱", names: ["non-potable_water"] },
    { emoji: "🔞", names: ["underage"] },
    { emoji: "📵", names: ["no_mobile_phones"] },
    { emoji: "🚭", names: ["no_smoking"] },
    { emoji: "✅", names: ["white_check_mark", "check"] },
    { emoji: "☑️", names: ["ballot_box_with_check"] },
    { emoji: "✔️", names: ["heavy_check_mark"] },
    { emoji: "✖️", names: ["heavy_multiplication_x"] },
    { emoji: "➕", names: ["heavy_plus_sign", "plus"] },
    { emoji: "➖", names: ["heavy_minus_sign", "minus"] },
    { emoji: "➗", names: ["heavy_division_sign"] },
    { emoji: "🟰", names: ["heavy_equals_sign"] },
    { emoji: "♾️", names: ["infinity"] },
    { emoji: "‼️", names: ["bangbang"] },
    { emoji: "⁉️", names: ["interrobang"] },
    { emoji: "❓", names: ["question"] },
    { emoji: "❔", names: ["grey_question"] },
    { emoji: "❕", names: ["grey_exclamation"] },
    { emoji: "❗", names: ["exclamation", "heavy_exclamation_mark"] },
    { emoji: "〰️", names: ["wavy_dash"] },
    { emoji: "💱", names: ["currency_exchange"] },
    { emoji: "💲", names: ["heavy_dollar_sign", "dollar"] },
    { emoji: "⚕️", names: ["medical_symbol"] },
    { emoji: "♻️", names: ["recycle"] },
    { emoji: "⚜️", names: ["fleur_de_lis"] },
    { emoji: "🔱", names: ["trident"] },
    { emoji: "📛", names: ["name_badge"] },
    { emoji: "🔰", names: ["beginner"] },
    { emoji: "⭐", names: ["star"] },
    { emoji: "🌟", names: ["star2", "glowing_star"] },
    { emoji: "✨", names: ["sparkles"] },
    { emoji: "⚡", names: ["zap", "lightning"] },
    { emoji: "☄️", names: ["comet"] },
    { emoji: "💥", names: ["boom", "collision"] },
    { emoji: "🔥", names: ["fire", "flame"] },
    { emoji: "🌈", names: ["rainbow"] },
    { emoji: "☀️", names: ["sunny", "sun"] },
    { emoji: "⛅", names: ["partly_sunny"] },
    { emoji: "☁️", names: ["cloud"] },
    { emoji: "⛈️", names: ["thunder_cloud_and_rain"] },
    { emoji: "🌤️", names: ["mostly_sunny", "sun_small_cloud"] },
    { emoji: "🌥️", names: ["barely_sunny", "sun_behind_cloud"] },
    { emoji: "🌦️", names: ["partly_sunny_rain", "sun_behind_rain_cloud"] },
    { emoji: "🌧️", names: ["rain_cloud"] },
    { emoji: "🌨️", names: ["snow_cloud"] },
    { emoji: "🌩️", names: ["lightning", "lightning_cloud"] },
    { emoji: "🌪️", names: ["tornado", "tornado_cloud"] },
    { emoji: "🌫️", names: ["fog"] },
    { emoji: "🌬️", names: ["wind_blowing_face"] },
    { emoji: "🌀", names: ["cyclone"] },
    { emoji: "❄️", names: ["snowflake"] },
    { emoji: "☃️", names: ["snowman"] },
    { emoji: "⛄", names: ["snowman2", "snowman_without_snow"] },
    { emoji: "☔", names: ["umbrella"] },
    { emoji: "💧", names: ["droplet"] },
    { emoji: "💦", names: ["sweat_drops"] },
    { emoji: "🌊", names: ["ocean", "wave"] },
  ],
  "Natura": [
    { emoji: "🌍", names: ["earth_africa"] },
    { emoji: "🌎", names: ["earth_americas"] },
    { emoji: "🌏", names: ["earth_asia"] },
    { emoji: "🌐", names: ["globe_with_meridians"] },
    { emoji: "🗺️", names: ["world_map"] },
    { emoji: "🗾", names: ["japan"] },
    { emoji: "🧭", names: ["compass"] },
    { emoji: "🏔️", names: ["snow_capped_mountain", "mountain_snow"] },
    { emoji: "⛰️", names: ["mountain"] },
    { emoji: "🌋", names: ["volcano"] },
    { emoji: "🗻", names: ["mount_fuji"] },
    { emoji: "🏕️", names: ["camping"] },
    { emoji: "🏖️", names: ["beach_with_umbrella"] },
    { emoji: "🏜️", names: ["desert"] },
    { emoji: "🏝️", names: ["desert_island"] },
    { emoji: "🏞️", names: ["national_park"] },
    { emoji: "🌲", names: ["evergreen_tree"] },
    { emoji: "🌳", names: ["deciduous_tree"] },
    { emoji: "🌴", names: ["palm_tree"] },
    { emoji: "🌵", names: ["cactus"] },
    { emoji: "🌾", names: ["ear_of_rice"] },
    { emoji: "🌿", names: ["herb"] },
    { emoji: "☘️", names: ["shamrock"] },
    { emoji: "🍀", names: ["four_leaf_clover"] },
    { emoji: "🍁", names: ["maple_leaf"] },
    { emoji: "🍂", names: ["fallen_leaf"] },
    { emoji: "🍃", names: ["leaves"] },
    { emoji: "🌺", names: ["hibiscus"] },
    { emoji: "🌻", names: ["sunflower"] },
    { emoji: "🌼", names: ["blossom"] },
    { emoji: "🌷", names: ["tulip"] },
    { emoji: "🌹", names: ["rose"] },
    { emoji: "🥀", names: ["wilted_flower"] },
    { emoji: "🌸", names: ["cherry_blossom"] },
    { emoji: "💐", names: ["bouquet"] },
    { emoji: "🍄", names: ["mushroom"] },
    { emoji: "🌰", names: ["chestnut"] },
    { emoji: "🦀", names: ["crab"] },
    { emoji: "🦞", names: ["lobster"] },
    { emoji: "🦐", names: ["shrimp"] },
    { emoji: "🦑", names: ["squid"] },
    { emoji: "🐚", names: ["shell"] },
  ],
  "Napoje": [
    { emoji: "☕", names: ["coffee"] },
    { emoji: "🍵", names: ["tea"] },
    { emoji: "🧃", names: ["beverage_box", "juice_box"] },
    { emoji: "🥤", names: ["cup_with_straw"] },
    { emoji: "🧋", names: ["bubble_tea"] },
    { emoji: "🍶", names: ["sake"] },
    { emoji: "🍾", names: ["champagne", "bottle_with_popping_cork"] },
    { emoji: "🍷", names: ["wine_glass"] },
    { emoji: "🍸", names: ["cocktail"] },
    { emoji: "🍹", names: ["tropical_drink"] },
    { emoji: "🍺", names: ["beer"] },
    { emoji: "🍻", names: ["beers"] },
    { emoji: "🥂", names: ["clinking_glasses"] },
    { emoji: "🥃", names: ["tumbler_glass", "whisky"] },
    { emoji: "🧊", names: ["ice_cube"] },
    { emoji: "🥄", names: ["spoon"] },
    { emoji: "🍴", names: ["fork_and_knife"] },
    { emoji: "🍽️", names: ["knife_fork_plate"] },
  ],
  "Liczby": [
    { emoji: "0️⃣", names: ["zero"] },
    { emoji: "1️⃣", names: ["one"] },
    { emoji: "2️⃣", names: ["two"] },
    { emoji: "3️⃣", names: ["three"] },
    { emoji: "4️⃣", names: ["four"] },
    { emoji: "5️⃣", names: ["five"] },
    { emoji: "6️⃣", names: ["six"] },
    { emoji: "7️⃣", names: ["seven"] },
    { emoji: "8️⃣", names: ["eight"] },
    { emoji: "9️⃣", names: ["nine"] },
    { emoji: "🔟", names: ["ten"] },
    { emoji: "#️⃣", names: ["hash"] },
    { emoji: "*️⃣", names: ["asterisk", "keycap_star"] },
    { emoji: "🔢", names: ["1234", "numbers"] },
  ],
  "Strzałki": [
    { emoji: "⬆️", names: ["arrow_up"] },
    { emoji: "↗️", names: ["arrow_upper_right"] },
    { emoji: "➡️", names: ["arrow_right"] },
    { emoji: "↘️", names: ["arrow_lower_right"] },
    { emoji: "⬇️", names: ["arrow_down"] },
    { emoji: "↙️", names: ["arrow_lower_left"] },
    { emoji: "⬅️", names: ["arrow_left"] },
    { emoji: "↖️", names: ["arrow_upper_left"] },
    { emoji: "↕️", names: ["arrow_up_down"] },
    { emoji: "↔️", names: ["left_right_arrow"] },
    { emoji: "↩️", names: ["leftwards_arrow_with_hook"] },
    { emoji: "↪️", names: ["arrow_right_hook"] },
    { emoji: "⤴️", names: ["arrow_heading_up"] },
    { emoji: "⤵️", names: ["arrow_heading_down"] },
    { emoji: "🔃", names: ["arrows_clockwise"] },
    { emoji: "🔄", names: ["arrows_counterclockwise"] },
    { emoji: "🔙", names: ["back"] },
    { emoji: "🔚", names: ["end"] },
    { emoji: "🔛", names: ["on"] },
    { emoji: "🔜", names: ["soon"] },
    { emoji: "🔝", names: ["top"] },
  ],
  "Kształty": [
    { emoji: "🔴", names: ["red_circle"] },
    { emoji: "🟠", names: ["orange_circle"] },
    { emoji: "🟡", names: ["yellow_circle"] },
    { emoji: "🟢", names: ["green_circle"] },
    { emoji: "🔵", names: ["blue_circle"] },
    { emoji: "🟣", names: ["purple_circle"] },
    { emoji: "🟤", names: ["brown_circle"] },
    { emoji: "⚫", names: ["black_circle"] },
    { emoji: "⚪", names: ["white_circle"] },
    { emoji: "🟥", names: ["red_square"] },
    { emoji: "🟧", names: ["orange_square"] },
    { emoji: "🟨", names: ["yellow_square"] },
    { emoji: "🟩", names: ["green_square"] },
    { emoji: "🟦", names: ["blue_square"] },
    { emoji: "🟪", names: ["purple_square"] },
    { emoji: "🟫", names: ["brown_square"] },
    { emoji: "⬛", names: ["black_large_square"] },
    { emoji: "⬜", names: ["white_large_square"] },
    { emoji: "◼️", names: ["black_medium_square"] },
    { emoji: "◻️", names: ["white_medium_square"] },
    { emoji: "◾", names: ["black_medium_small_square"] },
    { emoji: "◽", names: ["white_medium_small_square"] },
    { emoji: "▪️", names: ["black_small_square"] },
    { emoji: "▫️", names: ["white_small_square"] },
    { emoji: "🔶", names: ["large_orange_diamond"] },
    { emoji: "🔷", names: ["large_blue_diamond"] },
    { emoji: "🔸", names: ["small_orange_diamond"] },
    { emoji: "🔹", names: ["small_blue_diamond"] },
    { emoji: "🔺", names: ["small_red_triangle"] },
    { emoji: "🔻", names: ["small_red_triangle_down"] },
    { emoji: "💠", names: ["diamond_shape_with_a_dot_inside"] },
    { emoji: "🔘", names: ["radio_button"] },
    { emoji: "🔳", names: ["white_square_button"] },
    { emoji: "🔲", names: ["black_square_button"] },
  ],
  "Flagi": [
    { emoji: "🏁", names: ["checkered_flag"] },
    { emoji: "🚩", names: ["triangular_flag_on_post"] },
    { emoji: "🎌", names: ["crossed_flags"] },
    { emoji: "🏴", names: ["black_flag"] },
    { emoji: "🏳️", names: ["white_flag"] },
    { emoji: "🏳️‍🌈", names: ["rainbow_flag", "pride_flag"] },
    { emoji: "🏴‍☠️", names: ["pirate_flag"] },
    { emoji: "🇵🇱", names: ["flag_pl", "poland"] },
    { emoji: "🇺🇸", names: ["flag_us", "usa"] },
    { emoji: "🇬🇧", names: ["flag_gb", "uk"] },
    { emoji: "🇩🇪", names: ["flag_de", "germany"] },
    { emoji: "🇫🇷", names: ["flag_fr", "france"] },
    { emoji: "🇪🇸", names: ["flag_es", "spain"] },
    { emoji: "🇮🇹", names: ["flag_it", "italy"] },
    { emoji: "🇷🇺", names: ["flag_ru", "russia"] },
    { emoji: "🇨🇳", names: ["flag_cn", "china"] },
    { emoji: "🇯🇵", names: ["flag_jp", "japan"] },
    { emoji: "🇰🇷", names: ["flag_kr", "korea"] },
    { emoji: "🇧🇷", names: ["flag_br", "brazil"] },
    { emoji: "🇨🇦", names: ["flag_ca", "canada"] },
    { emoji: "🇦🇺", names: ["flag_au", "australia"] },
    { emoji: "🇲🇽", names: ["flag_mx", "mexico"] },
    { emoji: "🇮🇳", names: ["flag_in", "india"] },
    { emoji: "🇳🇱", names: ["flag_nl", "netherlands"] },
    { emoji: "🇸🇪", names: ["flag_se", "sweden"] },
    { emoji: "🇳🇴", names: ["flag_no", "norway"] },
    { emoji: "🇩🇰", names: ["flag_dk", "denmark"] },
    { emoji: "🇫🇮", names: ["flag_fi", "finland"] },
    { emoji: "🇨🇭", names: ["flag_ch", "switzerland"] },
    { emoji: "🇦🇹", names: ["flag_at", "austria"] },
    { emoji: "🇧🇪", names: ["flag_be", "belgium"] },
    { emoji: "🇵🇹", names: ["flag_pt", "portugal"] },
    { emoji: "🇬🇷", names: ["flag_gr", "greece"] },
    { emoji: "🇹🇷", names: ["flag_tr", "turkey"] },
    { emoji: "🇺🇦", names: ["flag_ua", "ukraine"] },
    { emoji: "🇨🇿", names: ["flag_cz", "czech"] },
    { emoji: "🇸🇰", names: ["flag_sk", "slovakia"] },
    { emoji: "🇭🇺", names: ["flag_hu", "hungary"] },
    { emoji: "🇷🇴", names: ["flag_ro", "romania"] },
  ],
};

export default function EmojiPicker({ onEmojiSelect, buttonText = "Dodaj emoji" }: EmojiPickerProps) {
  const { customEmojis, loading, fetchEmojis } = useEmojis();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("unicode");

  const [botEmojis, setBotEmojis] = useState<BotEmoji[]>([]);
  const [botEmojisLoading, setBotEmojisLoading] = useState(false);
  const [botEmojisLoaded, setBotEmojisLoaded] = useState(false);

  const fetchBotEmojis = async () => {
    if (botEmojisLoaded || botEmojisLoading) return;
    setBotEmojisLoading(true);
    try {
      const res = await fetch("/api/bot-emojis/list");
      if (res.ok) {
        const data: BotEmoji[] = await res.json();
        setBotEmojis(data);
        setBotEmojisLoaded(true);
      }
    } catch {
      // ignore
    } finally {
      setBotEmojisLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchEmojis();
    }
  }, [open, fetchEmojis]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "bot") fetchBotEmojis();
  };

  const handleEmojiClick = (emoji: string | CustomEmoji | BotEmoji) => {
    if (typeof emoji === "string") {
      onEmojiSelect(emoji);
    } else {
      const format = emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
      onEmojiSelect(format);
    }
    setOpen(false);
  };

  const filteredBotEmojis = botEmojis.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredCustomEmojis = customEmojis.filter((emoji) =>
    emoji.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUnicodeEmojis = Object.entries(unicodeEmojis).reduce((acc, [category, emojiList]) => {
    const filtered = emojiList.filter((item) => {
      if (search === "") return true;
      const searchLower = search.toLowerCase();
      return item.names.some(name => name.includes(searchLower));
    });
    if (filtered.length > 0) {
      acc[category] = filtered;
    }
    return acc;
  }, {} as Record<string, EmojiWithName[]>);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Smile className="mr-2 h-4 w-4" />
          {buttonText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[450px] max-w-[450px] p-0" align="start">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Szukaj emoji..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full grid grid-cols-3 rounded-none border-b">
            <TabsTrigger value="unicode">Standardowe</TabsTrigger>
            <TabsTrigger value="custom">
              Serwer {customEmojis.length > 0 && `(${customEmojis.length})`}
            </TabsTrigger>
            <TabsTrigger value="bot">
              Bot {botEmojis.length > 0 && `(${botEmojis.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="unicode" className="m-0">
            <ScrollArea className="h-[300px]">
              <div className="p-3 space-y-4">
                {Object.entries(filteredUnicodeEmojis).map(([category, emojiList]) => (
                  <div key={category}>
                    <h3 className="text-xs font-semibold mb-2 text-muted-foreground">
                      {category}
                    </h3>
                    <div className="grid grid-cols-8 gap-1">
                      {emojiList.map((item, idx) => (
                        <button
                          key={`${item.emoji}-${idx}`}
                          type="button"
                          onClick={() => handleEmojiClick(item.emoji)}
                          className="w-10 h-10 flex items-center justify-center text-2xl hover:bg-accent rounded transition-colors"
                          title={`:${item.names[0]}:`}
                        >
                          {item.emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="custom" className="m-0">
            <ScrollArea className="h-[300px]">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">Ładowanie emoji...</p>
                </div>
              ) : filteredCustomEmojis.length === 0 ? (
                <div className="flex items-center justify-center h-full p-4">
                  <p className="text-sm text-muted-foreground text-center">
                    {customEmojis.length === 0
                      ? "Brak dostępnych niestandardowych emoji"
                      : "Nie znaleziono emoji"}
                  </p>
                </div>
              ) : (
                <div className="p-3 space-y-4">
                  {/* Group by guild */}
                  {Object.entries(
                    filteredCustomEmojis.reduce((acc, emoji) => {
                      if (!acc[emoji.guildName]) {
                        acc[emoji.guildName] = [];
                      }
                      acc[emoji.guildName].push(emoji);
                      return acc;
                    }, {} as Record<string, CustomEmoji[]>)
                  ).map(([guildName, emojis]) => (
                    <div key={guildName}>
                      <h3 className="text-xs font-semibold mb-2 text-muted-foreground">
                        {guildName}
                      </h3>
                      <div className="grid grid-cols-6 gap-1">
                        {emojis.map((emoji) => (
                          <button
                            key={emoji.id}
                            type="button"
                            onClick={() => handleEmojiClick(emoji)}
                            className="w-12 h-12 flex items-center justify-center hover:bg-accent rounded transition-colors group relative"
                            title={emoji.name}
                          >
                            <img
                              src={emoji.url}
                              alt={emoji.name}
                              className="w-8 h-8 object-contain"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="bot" className="m-0">
            <ScrollArea className="h-[300px]">
              {botEmojisLoading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">Ładowanie emoji bota...</p>
                </div>
              ) : filteredBotEmojis.length === 0 ? (
                <div className="flex items-center justify-center h-full p-4">
                  <p className="text-sm text-muted-foreground text-center">
                    {botEmojis.length === 0
                      ? "Brak emoji bota"
                      : "Nie znaleziono emoji"}
                  </p>
                </div>
              ) : (
                <div className="p-3">
                  <div className="grid grid-cols-6 gap-1">
                    {filteredBotEmojis.map((emoji) => {
                      const ext = emoji.animated ? "gif" : "png";
                      const url = `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=64`;
                      return (
                        <button
                          key={emoji.id}
                          type="button"
                          onClick={() => handleEmojiClick(emoji)}
                          className="w-12 h-12 flex items-center justify-center hover:bg-accent rounded transition-colors"
                          title={emoji.name}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={emoji.name} className="w-8 h-8 object-contain" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
