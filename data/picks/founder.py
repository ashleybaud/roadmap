#!/usr/bin/env python3
"""Founder's trips from onetrackmind.co.za, merged into picks.json.
Run: python3 data/picks/founder.py   (rewrites picks.json; keeps the other picks)
draft=True: hidden from the picks list and the route pages until checked (open with /?drafts=1)."""
import json, pathlib
HERE = pathlib.Path(__file__).parent
BLOG = "https://onetrackmind.co.za"

def P(name, lat, lon, **k):
    d = {"name": name, "lat": lat, "lon": lon}; d.update(k); return d

def day(to, vias=(), **k):
    d = {"to": to, "vias": list(vias), "style": "default", "legs": []}; d.update(k); return d

# places
CPT = P("Cape Town", -33.92487, 18.42406)
WHK = P("Windhoek", -22.57761, 17.07727)

TRIPS = [
 dict(id="namibia-2020-tortoise", title="Northern Namibia in the Tortoise",
  region="Namibia · Etosha, Kunene, Skeleton Coast", style="rough", vehicles=["jeep", "car"],
  blurb="Ten days in a rented 4x4 camper: Etosha, Opuwo, Epupa Falls, Palmwag and down the Skeleton Coast to Walvis. Washed-away roads and blind river crossings after the rains.",
  founder=dict(year=2020, ride="Toyota 4x4 camper (the Tortoise), two-up",
   story="The trip started with an expired passport at the check-in counter and only got better. Ten days in a rented camper with Logistics, no fixed plan and a paper map. Etosha after the rains, puddles deep enough to lose a number plate. Back to Opuwo, where the 2017 bike trip fell apart. Five hours for 180 km to Epupa, river crossings washed away, a croc in the reeds. Then Sesfontein, Palmwag, a puncture at 40 degrees and the Skeleton Coast, which my father always talked about and never saw. Not the same as a bike. Flexible, comfortable, and it still clears the mind.",
   posts=[("Day 0: We haven't left yet", "/2020/01/17/2020-namibia-day-0-we-havent-left-yet/"), ("Day 4: Why I ride", "/2020/01/20/2020-namibia-day-4-why-i-ride/"), ("Day 6: Punctured", "/2020/01/22/2020-namibia-day-5-punctured/"), ("Day 7: Skeleton Coast", "/2020/01/23/2020-namibia-day-6-skeleton-coast/"), ("Day 9: The End", "/2020/01/26/2020-namibia-day-9-the-end/")],
   tips=["Gondwana Card: South Africans save up to half on Gondwana lodges.", "Epupa: don't swim in the river. Crocodiles.", "Fill up at Torra Bay junction; fuel is far apart on the coast.", "Two nights at Epupa. The planner shows it as one stop; add a rest day yourself."]),
  trip=dict(start=WHK, end=WHK, round=False, days=[
   day(P("Outjo", -20.11186, 16.15669)),
   day(P("Namutoni (Etosha)", -18.80811, 16.94007), [P("Andersson Gate", -19.33145, 15.94018)]),
   day(P("Opuwo Country Lodge", -18.04461, 13.83337)),
   day(P("Omarunga, Epupa Falls", -17.00205, 13.24615)),
   day(P("Palmwag Lodge", -19.88568, 13.93691), [P("Opuwo", -18.06, 13.84, fast=True), P("Sesfontein", -19.12317, 13.61758)]),
   day(P("Henties Bay", -22.11597, 14.28266), [P("Springbokwasser Gate", -20.31055, 13.64769), P("Torra Bay", -20.32287, 13.23804)]),
   day(P("Walvis Bay", -22.95576, 14.50711)),
   day(P("Windhoek Game Camp", -22.41504, 17.05086)),
  ])),

 dict(id="namibia-2020-orange-river", title="Fish River Canyon and the Orange River",
  region="Northern Cape · Southern Namibia", style="rough", vehicles=["bike", "jeep", "car"],
  blurb="Cape Town to Canyon Village in one 850 km day, the Fish River Canyon, the hot tar to Aus, then the Orange River road from Rosh Pinah to Noordoewer. Back over Piekenierskloof.",
  founder=dict(year=2020, ride="KTM 1290 Super Adventure, four riders",
   story="A spontaneous baby shower for a riding mate. In Namibia, obviously. Day one was 850 km and my kind of day. Then the Fish River Canyon, Canyon Roadhouse and the straightest, hottest tar to Klein Aus at 41 degrees. Day three is the reason to go: the Orange River between Rosh Pinah and Noordoewer, my favourite piece of riding anywhere in the world. Fast, flowing, wheel to wheel with mates. TKC80s gave me grip to choose my lines while the General's tyres kept trying to put him in the river.",
   posts=[("Day 1", "/2020/02/01/namibia-2-day-1/"), ("Day 2", "/2020/02/02/namibia-2-day-2/"), ("Day 3", "/2020/02/03/namibia-2-day-3/"), ("Day 4", "/2020/02/04/namibia-2-day-4/")],
   tips=["Day 1 is 850 km. Split it at Springbok if you want to enjoy it.", "Fill up at every town on the way home: Steinkopf, Springbok, Vanrhynsdorp, Klawer.", "Tyre choice matters on the river road; knobblies win."]),
  trip=dict(start=CPT, end=CPT, round=False, days=[
   day(P("Canyon Village", -27.65535, 17.76667), [P("Piekenierskloof Pass", -32.64294, 18.94755, type="pass"), P("Springbok", -29.66609, 17.8831, fast=True), P("Noordoewer", -28.72197, 17.61798, fast=True)], toFast=True),
   day(P("Klein-Aus Vista", -26.65611, 16.23389), [P("Hobas (Fish River Canyon)", -27.61891, 17.71596), P("Canyon Roadhouse", -27.52418, 17.81483), P("Seeheim", -26.81625, 17.79998)]),
   day(P("Felix Unite, Noordoewer", -28.73, 17.63), [P("Rosh Pinah", -27.96424, 16.76108)]),
   day(None, [P("Steinkopf", -29.2625, 17.73333, fast=True), P("Springbok", -29.66609, 17.8831, fast=True), P("Klawer", -31.775, 18.62556, fast=True)], toFast=True),
  ])),

 dict(id="namibia-2017-epupa", title="Destination Epupa Falls",
  region="Namibia · Fish River to Kunene", style="rough", vehicles=["bike", "jeep"],
  blurb="Canyon Village, Sesriem, Swakopmund, Grootberg and north to Epupa Falls on the Angolan border, back via Opuwo and Windhoek. Sand, corrugations and long gaps between fuel.",
  founder=dict(year=2017, ride="KTM 1290 Super Adventure, with 990, 1190 and an Africa Twin",
   story="A sandstorm on day one, a broken arm on day two, a tyre change by committee in the middle of nowhere and an oil light 180 km from Angola. Textbook how not to adventure bike, which is exactly why we ran bootcamps. We still made Epupa Falls. When I stopped at Opuwo, a lodge owner I'd never met drove me and the bike to Oshakati and sorted the rest over a braai. Namibia does that. It was my father's birthday at the falls. Couldn't think of a better place to spend it.",
   posts=[("Shakedown. Literally.", "/2017/06/26/namibia-2017-day-2/"), ("Sandmonster bites", "/2017/07/17/namibia-2017-day-3/"), ("Grootberg", "/2017/07/18/namibia-2017-day-5/"), ("Tyred", "/2017/07/19/namibia-2017-day-6/"), ("Adventure 101", "/2017/07/19/namibia-2017-day-7/"), ("Tough Call", "/2017/07/19/namibia-day-8/")],
   tips=["Fill up at every station you pass north of Henties Bay.", "Carry a satellite phone. Cell signal is good in towns, nothing in between.", "Grootberg Lodge: 4x4 or motorbike for the driveway.", "Heed the oil light. Nothing good comes from pushing on."]),
  trip=dict(start=P("Noordoewer", -28.72197, 17.61798), end=WHK, round=False, days=[
   day(P("Canyon Village", -27.65535, 17.76667)),
   day(P("Tsauchab River Camp", -24.44585, 16.17174)),
   day(P("Swakopmund", -22.6784, 14.5266)),
   day(P("Grootberg Lodge", -19.85108, 14.1332), [P("Henties Bay", -22.11597, 14.28266)]),
   day(P("Epupa Falls", -17.00205, 13.24615), [P("Opuwo", -18.06, 13.84)]),
   day(P("Opuwo Country Lodge", -18.04461, 13.83337)),
   day(None),
  ])),

 dict(id="wild-coast-2019", title="Wild Coast to Cape Town",
  region="Eastern Cape · Garden Route · Klein Karoo", style="mixed", vehicles=["bike", "jeep"],
  blurb="Port St Johns down the old Transkei to Wavecrest, the Kei mouth pont, East London, Port Alfred, the Langkloof to Oudtshoorn and home through Seweweekspoort.",
  founder=dict(year=2019, ride="KTM 790 Adventure (the Silent Assassin)",
   story="The day of avoidance: dogs, pigs, goats, cows, horses, taxis, drunk taxis, potholes and ruts, on a roadbook from a local in Port St Johns. Rain had washed the gravel into ruts. I tried to ride places I'd never been, ran low on fuel looking for the Kei pont, and snuck a lap of the East London GP circuit. Missed the Baviaans turn lost in my thoughts and took the Langkloof instead. Last night at Buffelsdrift with an owner who'd built it for conservation. If your job is stressful, ride shorter days and stop more.",
   posts=[("Port St Johns to Wavecrest", "/2019/06/16/port-st-johns-wavecrest/"), ("Wavecrest to Port Alfred", "/2019/06/17/wavecrest-port-alfred/"), ("Port Alfred to Oudtshoorn", "/2019/06/18/port-alfred-oudtshoorn/"), ("Oudtshoorn to Cape Town", "/2019/06/19/oudtshoorn-cape-town/")],
   tips=["Livestock and taxis on every road in the old Transkei. Ride slower than you think.", "Fuel range lulls you. Fill up before hunting for the Kei mouth pont.", "Day 1 from Durban isn't in the blog; the story starts at Port St Johns."]),
  trip=dict(start=P("Durban", -29.86181, 31.00991), end=CPT, round=False, days=[
   day(P("Port St Johns", -31.62045, 29.54534), toFast=True),
   day(P("Wavecrest", -32.58537, 28.52304), [P("Coffee Bay", -31.9852, 29.14697)]),
   day(P("Port Alfred", -33.59818, 26.89148), [P("Morgan Bay", -32.70515, 28.33968), P("East London GP Circuit", -33.0459, 27.8746, fast=True)]),
   day(P("Buffelsdrift, Oudtshoorn", -33.52883, 22.2522), [P("Langkloof", -33.77694, 23.58639)]),
   day(None, [P("Cango Caves", -33.39228, 22.21438), P("Calitzdorp", -33.53267, 21.68786), P("Seweweekspoort", -33.42667, 21.42454, type="pass")], toFast=True),
  ])),

 dict(id="seven-passes-prince-alfred", title="Montagu Pass, Seven Passes and Prince Alfred's",
  region="Garden Route · Outeniqua", style="rough", vehicles=["bike", "jeep", "car"],
  blurb="A loop from Louvain Guest Farm: down Montagu Pass, the old Seven Passes road through the forest to Knysna, then up Prince Alfred's Pass for a burger at De Vlugt.",
  founder=dict(year=2020, ride="KTM, on the CDBA weekend",
   story="A sublime morning over Montagu Pass, a road I first rode in Ducati leathers on a 950 doing Uniondale, Baviaanskloof and back to Knysna in a day. It was my mother's birthday. Then the Seven Passes through the back of Wilderness into Knysna and up Prince Alfred's. Not without drama: a sidecar in the forest, then a rider with no talent left crashing into the scene. Ride your own pace on these passes. They're narrow, blind, and other people use them too.",
   posts=[("CDBA Day 3", "/2020/02/22/2020-cdba-day-3/"), ("CDBA Reflections", "/2020/02/23/2020-cdba-day-4/")],
   tips=["Prince Alfred's Pass is narrow with blind corners. Expect someone in your lane.", "Angie's G Spot at De Vlugt for lunch.", "Cell signal is patchy on the passes; know who to call."]),
  trip=dict(start=P("Louvain Guest Farm", -33.81259, 22.65534), end=None, round=True, days=[
   day(None, [P("Montagu Pass", -33.86957, 22.44649, type="pass"), P("Wilderness", -33.99324, 22.57863), P("Knysna", -34.03573, 23.04848), P("Prince Alfred's Pass", -33.75883, 23.16262, type="pass"), P("Angie's G Spot, De Vlugt", -33.81269, 23.175), P("Uniondale", -33.65556, 23.12556, fast=True)], toFast=True),
  ])),

 dict(id="speedweek-hakskeenpan", title="Speedweek run to Hakskeenpan",
  region="Northern Cape · Kalahari", style="mixed", vehicles=["jeep", "car", "bike"],
  blurb="Cape Town over Sutherland and Calvinia to Upington and out to Hakskeenpan for Speedweek. Home via Augrabies and Springbok.",
  founder=dict(year=2014, ride="Prado with a KTM 1190R on the trailer",
   story="It started over G&Ts on a Friday afternoon with a plan to charter a helicopter. The helicopter didn't happen, so we left at 4am with spare clothes and no tent. Sutherland and Calvinia to dodge the N7 roadworks, firewood from Upington because that makes you the hero, and 1,250 km later a Mad Max sunset on the pan. Next day a mate did 246 km/h on an adventure bike. The helicopter might have been cheaper.",
   posts=[("Speedweek 2014, Hakskeenpan", "/2018/05/11/speedweek-2014-hakskeenpan/")],
   tips=["We did 1,250 km in one day. Don't. Sleep in Upington.", "Take firewood from Upington. There's none on the pan.", "Book or bring a tent. Speedweek fills up."]),
  trip=dict(start=CPT, end=CPT, round=False, days=[
   day(P("Upington", -28.45632, 21.24187), [P("Sutherland", -32.39389, 20.66111), P("Calvinia", -31.46944, 19.77722)]),
   day(P("Hakskeenpan", -26.8194, 20.22501)),
   day(P("Springbok", -29.66609, 17.8831), [P("Augrabies Falls", -28.59157, 20.34065)]),
   day(None, toFast=True),
  ])),

 dict(id="eu-road-trip-2018", title="EU Road Trip 2018: Mattighofen to Goodwood and back",
  region="Austria · Germany · Belgium · UK · France · Italy", style="tar", vehicles=["bike", "car"],
  blurb="5,609 km on two KTM 790 Dukes: Porsche Museum, Hockenheim, a lap of the Nürburgring, Spa, Aston Martin, Alfaholics, Brooklands, Goodwood Festival of Speed, the Riviera, Lucca, Tavullia, World Ducati Week, Modena and home over the Alps.",
  founder=dict(year=2018, ride="KTM 790 Duke, two mates",
   story="A trip of a lifetime that changed my life. A TV reviewer said nobody should tour on a 790 Duke. We did 5,609 km, six countries, at 5.4 litres per 100. The Nürburgring on a public Sunday, first time, on motorcycles. Aston Martin's factory, Alfaholics, Brooklands. My mate won the pillion seat in the Vulcan up the hill at Goodwood. An overnight ferry to France, sleeping on deck on the Riviera, Lenny Kravitz by accident in Lucca, a night opposite Rossi's ranch and World Ducati Week. 212 km of rain to finish. Grinning in my helmet the whole way.",
   posts=[("The whole trip", "/euroadtrip2018/"), ("Hockenheim and the Nürburgring", "/2018/07/08/euroadtrip2018-nurburgring/"), ("Goodwood Festival of Speed", "/2018/07/15/euroadtrip2018-goodwood-festival-of-speed/"), ("Lenny in Lucca", "/2018/07/18/euroroadtrip2018-lenny-in-lucca/"), ("World Ducati Week", "/2018/07/20/euroadtrip2018-world-ducati-week/")],
   tips=["The Channel: we took the Eurotunnel out and an overnight ferry from Portsmouth back. The planner routes the ferry.", "Bike theft is real in the UK. Lock it to something.", "Nights in England are approximate where the blog doesn't say."]),
  trip=dict(start=P("Mattighofen", 48.10308, 13.15031), end=P("Mattighofen", 48.10308, 13.15031), round=False, days=[
   day(P("Stuttgart", 48.8343, 9.15245), [P("Munich Airport", 48.35396, 11.77859, fast=True), P("Porsche Museum", 48.8343, 9.15245)]),
   day(P("Nürburg", 50.34134, 6.95192), [P("Hockenheimring", 49.3298, 8.5763)]),
   day(P("La Louvière", 50.47936, 4.18563), [P("Spa-Francorchamps", 50.43693, 5.97013)]),
   day(P("Banbury", 52.06018, -1.34028), [P("Calais", 50.95248, 1.85384, fast=True), P("Folkestone", 51.07913, 1.17941), P("Brands Hatch", 51.35749, 0.26001)]),
   day(P("Clevedon (Alfaholics)", 51.43606, -2.85265), [P("Aston Martin, Gaydon", 52.19594, -1.48846), P("Burford, Cotswolds", 51.8077, -1.6367)]),
   day(P("Shepperton", 51.39392, -0.44867)),
   day(P("Portsmouth", 50.80003, -1.0906), [P("Brooklands Museum", 51.35524, -0.46327), P("Wellington, Somerset", 50.97838, -3.22755)]),
   day(P("Portsmouth", 50.80003, -1.0906), [P("Goodwood Festival of Speed", 50.87231, -0.73927)]),
   day(P("Lyon", 45.75781, 4.83201), [P("Le Havre", 49.4944, 0.1079), P("Paris", 48.8535, 2.34839, fast=True)], toFast=True),
   day(P("Saint-Raphaël", 43.425, 6.7683), toFast=True),
   day(P("Lucca", 44.01776, 10.45443), [P("Nice", 43.70094, 7.26839), P("Monaco", 43.73235, 7.42768)]),
   day(P("Tavullia (VR46 MotoRanch)", 43.89776, 12.75479)),
   day(P("Modena", 44.65213, 10.93665), [P("Misano (World Ducati Week)", 43.96218, 12.68403), P("Museo Lamborghini, Sant'Agata", 44.65914, 11.12583), P("Pagani, San Cesario", 44.564, 11.0336)]),
   day(P("Innsbruck", 47.26543, 11.39277), toFast=True),
   day(None, toFast=True),
  ])),

 dict(id="eu-road-trip-2019", title="EU Road Trip 2019: KTM factory to San Marino MotoGP",
  region="Austria · Italy", style="tar", vehicles=["bike", "car"],
  blurb="From the KTM factory in Mattighofen: Hohenwerfen and the ice caves, then over the Alps to Misano for the San Marino MotoGP, and back via Venice.",
  founder=dict(year=2019, ride="KTM 1290 Super Duke GT",
   story="A dealer trip to the KTM factory, 235,000 bikes a year, and we were treated like VIPs. A cultural day that turned into a hike in the mist to an ice cave. When the boys flew home and Goodwood Revival fell through, I had three paid laps of the Nürburgring or Rossi at Misano. Rossi won't be around forever. A farmer's tan under the Italian sun, panniers that made MotoGP hands-free, then home via Venice to stay a block and a half from where 2018 started. Full circle.",
   posts=[("KTM Factory Tour Day 2", "/2019/09/10/2019-ktm-factory-tour-day-2/"), ("Day 4: Hohenwerfen", "/2019/09/12/2019-ktm-factory-tour-day-4/"), ("Austria to Italy", "/2019/09/14/euroadtrip2019-austria-to-italy/"), ("MotoGP San Marino", "/2019/09/15/euroadtrip2019-motogp-sanmarino/"), ("Back to Salzburg", "/2019/09/16/euroadtrip2019-one-night-in-salzburg/")],
   tips=["Book the Eisriesenwelt and don't believe 'short walk'. It's a climb.", "Local SIM in Italy: cheap data for the whole of Europe.", "Panniers make a race weekend easy: lock the helmet away and walk."]),
  trip=dict(start=P("Mattighofen", 48.10308, 13.15031), end=P("Salzburg", 47.79813, 13.04648), round=False, days=[
   day(P("Mattighofen", 48.10308, 13.15031), [P("Burg Hohenwerfen", 47.4836, 13.1878), P("Eisriesenwelt", 47.51086, 13.19323)]),
   day(P("Riccione", 43.99827, 12.64744)),
   day(P("Riccione", 43.99827, 12.64744), [P("Misano World Circuit", 43.96218, 12.68403)]),
   day(P("Mattighofen", 48.10308, 13.15031), [P("Venice (Mestre)", 45.48246, 12.2317)]),
   day(None, toFast=True),
  ])),

 dict(id="motor-valley-2017", title="Motor Valley and EICMA in a Fiat 500",
  region="Italy · Emilia-Romagna, Veneto, Lombardy, Piedmont", style="tar", vehicles=["car", "bike"],
  blurb="Milan to Bologna for Lamborghini, Pagani, Ducati and Ferrari, the back roads to Venice, EICMA in Milan, the Alfa Romeo museum at Arese, MV Agusta at Varese and the car museum in Turin.",
  founder=dict(year=2017, ride="Hired Fiat 500",
   story="A day flight via Dubai, no sleep, then a Fiat 500 for the ultimate road trip to Bologna. Lamborghini, Pagani, the Ducati museum for the first time in ten years, the back roads to Venice, single track both ways, very Italian. EICMA for the 790 Duke and the Adventure prototype. The Alfa Romeo museum, a bucket list tick. MV Agusta closed, so I asked security for a factory tour. Ten minutes later I had my own guide. Turin to finish. If fuel runs through your veins, go.",
   posts=[("790 reasons to attend EICMA", "/2017/11/01/790-reasons-to-attend-eicma-2017/"), ("Bologna, Ducati, Venice", "/2017/11/05/bologna-ducati-venice/"), ("Alfa Romeo Museum", "/2017/11/09/alfa-romeo-museum/"), ("MV Agusta factory tour", "/2017/11/10/mv-agusta/"), ("Museo dell'Automobile, Turin", "/2017/11/12/museo-nazionale-dellautomobile-di-torino/")],
   tips=["Venice parking fills up. Park at Mestre and take the train in.", "Ask nicely at the factories. It works more often than you'd think.", "Check museum opening hours; some only open in the afternoon."]),
  trip=dict(start=P("Milan Malpensa Airport", 45.62963, 8.72355), end=P("Turin", 45.03185, 7.67345), round=False, days=[
   day(P("Bologna", 44.49382, 11.34263), [P("Museo Lamborghini, Sant'Agata", 44.65914, 11.12583)], toFast=True),
   day(P("Bologna", 44.49382, 11.34263), [P("Pagani, San Cesario", 44.564, 11.0336), P("Museo Enzo Ferrari, Modena", 44.65213, 10.93665)]),
   day(P("Venice (Mestre)", 45.48246, 12.2317), [P("Ducati Museum, Borgo Panigale", 44.51616, 11.26843)]),
   day(P("Milan (EICMA, Rho Fiera)", 45.52117, 9.08847), toFast=True),
   day(None, [P("Alfa Romeo Museum, Arese", 45.55797, 9.04716), P("MV Agusta, Varese", 45.8038, 8.77816)], toFast=True),
  ])),

 # ---- drafts: route not clear from the blog; the founder checks them first ----
 dict(id="baviaanskloof-in-a-day", draft=True, title="Uniondale, Baviaanskloof and back to Knysna in a day",
  region="Garden Route · Baviaanskloof", style="rough", vehicles=["bike", "jeep"],
  blurb="Knysna over Montagu Pass to Uniondale, through the Baviaanskloof and back to Knysna. A long, big day.",
  founder=dict(year=None, ride="Ducati 950, in leathers",
   story="The first time I rode Montagu Pass: Uniondale, Baviaanskloof and back to Knysna in one day, on a 950 in Ducati leathers. The leathers were never the same.",
   posts=[("Mentioned in CDBA Day 3", "/2020/02/22/2020-cdba-day-3/")], tips=[]),
  trip=dict(start=P("Knysna", -34.03573, 23.04848), end=None, round=True, days=[
   day(None, [P("Montagu Pass", -33.86957, 22.44649, type="pass"), P("Uniondale", -33.65556, 23.12556), P("Willowmore", -33.2925, 23.4900), P("Patensie", -33.7582, 24.8178)]),
  ])),

 dict(id="simola-road-trip", draft=True, title="Road trip to Simola in the race car",
  region="Western Cape · Route 62", style="tar", vehicles=["car", "bike"],
  blurb="From the farm in the Swartland along Route 62 to Knysna for the Simola Hill Climb.",
  founder=dict(year=2025, ride="Alfa Romeo 105 race car",
   story="Road-tripping the race car to Simola felt like the spirit of the event. The wrong fuel pump made it a long day of stops and adjustments; the car set the pace, not the plan. And yet: on time, through scrutineering, event completed, 1:04.8.",
   posts=[("Progress, Accidentally", "/2026/03/29/progress-accidentally/")], tips=[]),
  trip=dict(start=P("Malmesbury", -33.46028, 18.72361), end=P("Simola, Knysna", -34.0245, 23.0693), round=False, days=[
   day(P("Oudtshoorn", -33.5903, 22.20421), [P("Montagu", -33.78699, 20.11783), P("Barrydale", -33.90412, 20.72136), P("Calitzdorp", -33.53267, 21.68786)]),
   day(None),
  ])),

 dict(id="montagu-classic", draft=True, title="Langeberg and Montagu in a classic",
  region="Western Cape · Breede River", style="tar", vehicles=["car", "bike"],
  blurb="A slow drive from the Swartland into the mountains around Montagu in a classic Alfa.",
  founder=dict(year=2024, ride="1971 Alfa Romeo 1750 GTV",
   story="Race car to build, so obviously we took a slow drive into the mountains around Montagu. Carburettor smells, carburettor sounds, precious cargo and no modern comforts. Everyone should explore their own country in a classic car.",
   posts=[("Langberg, Montagu", "/2024/06/07/langberg-montagu/")], tips=[]),
  trip=dict(start=P("Malmesbury", -33.46028, 18.72361), end=None, round=True, days=[
   day(P("Montagu", -33.78699, 20.11783)),
   day(None),
  ])),

 dict(id="lesotho-2016", draft=True, title="Lesotho after the Roof of Africa",
  region="Lesotho · Maseru, Semonkong, Malealea", style="rough", vehicles=["bike", "jeep"],
  blurb="Mountain Kingdom roads from Maseru: Roma, Semonkong and the Maletsunyane Falls, Malealea. Route to be confirmed.",
  founder=dict(year=2016, ride="KTM",
   story="Every year we supported up to 15 riders at the Roof of Africa. In 2016 we only had three entries, which left me free to take a couple of mates and explore Lesotho.",
   posts=[("Lesotho 2016, Roof of Africa Adventure", "/2016/12/17/roof-of-africa-2016-the-mountain-kingdom-of-lesotho/")], tips=[]),
  trip=dict(start=P("Ladybrand", -29.19271, 27.45759), end=None, round=True, days=[
   day(P("Semonkong", -29.84001, 28.0511), [P("Maseru", -29.31005, 27.47822, fast=True), P("Roma", -29.45055, 27.71415)]),
   day(P("Malealea", -29.82992, 27.60693)),
   day(None, [P("Maseru", -29.31005, 27.47822, fast=True)]),
  ])),
]

def main():
    f = HERE / "picks.json"; d = json.loads(f.read_text())
    ids = {t["id"] for t in TRIPS}
    keep = [r for r in d["routes"] if r["id"] not in ids]
    old = {r["id"]: r for r in d["routes"]}
    out = []
    for t in TRIPS:
        t = json.loads(json.dumps(t))
        fd = t["founder"]; fd["posts"] = [{"t": a, "u": BLOG + b} for a, b in fd["posts"]]
        if old.get(t["id"], {}).get("stats"): t["stats"] = old[t["id"]]["stats"]
        out.append(t)
    d["routes"] = out + keep
    f.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    print(len(out), "founder trips,", sum(1 for t in out if t.get("draft")), "drafts;", len(keep), "other picks")

if __name__ == "__main__": main()
