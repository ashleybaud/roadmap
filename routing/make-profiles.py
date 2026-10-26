import json
T=open('template.brf').read() if False else None
tpl='''---context:global
assign downhillcost 0
assign downhillcutoff 0
assign uphillcost 0
assign uphillcutoff 0
assign validForBikes 1
assign validForCars 1
assign turnInstructionMode = 0

---context:way
assign turncost = if junction=roundabout then 0 else 20
assign initialclassifier = if route=ferry then 1 else 0
assign initialcost switch route=ferry 20000 0
assign isresidentialorliving = or highway=residential|living_street living_street=yes
assign istrack = highway=track
assign motorvehicleaccess
  switch motor_vehicle=
    switch vehicle=
      switch access=
        switch highway=motorway|motorway_link {MWA}
        switch highway=trunk|trunk_link 1
        switch highway=primary|primary_link 1
        switch highway=secondary|secondary_link 1
        switch highway=tertiary|tertiary_link 1
        switch highway=unclassified 1
        switch route=ferry 1
        switch isresidentialorliving 1
        switch highway=service 1
        switch highway=track {TRKA}
        0
        access=yes|permissive|designated|destination
      vehicle=yes|permissive|designated|destination
    motor_vehicle=yes|permissive|designated|destination
assign vehicleaccess
  {VACC}
assign accesspenalty switch vehicleaccess 0 10000
assign onewaypenalty
  switch switch reversedirection=yes
         switch oneway=
                junction=roundabout
                oneway=yes|true|1
         oneway=-1
  10000
  0.0
assign islinktype = highway=motorway_link|trunk_link|primary_link|secondary_link|tertiary_link
assign ispaved = surface=paved|asphalt|concrete|paving_stones|sett
assign isunpaved = surface=unpaved|gravel|fine_gravel|compacted|dirt|earth|ground|sand|pebblestone|grass|mud
assign isgravel = or isunpaved and istrack not ispaved
assign costfactor
  add max onewaypenalty accesspenalty
  add switch islinktype 0.05 0
  switch and highway= not route=ferry 10000
  switch route=ferry 5.67
  switch isgravel ( switch istrack ( switch tracktype=grade4|grade5 {TRK45} {TRKC} ) {GRAV} )
  switch highway=motorway|motorway_link {CMW}
  switch highway=trunk|trunk_link {CT}
  switch highway=primary|primary_link {CP}
  switch highway=secondary|secondary_link {CS}
  switch highway=tertiary|tertiary_link {CTE}
  switch highway=unclassified {CU}
  switch isresidentialorliving 2
  switch highway=service 2
  switch istrack {TRKC}
  10000
assign priorityclassifier = 0
assign classifiermask = 0
assign dummyUsage = smoothness=

---context:node
assign motorvehicleaccess
  switch motor_vehicle=
    switch vehicle=
      switch access=
        switch barrier=bollard|cycle_barrier 0
        1
        access=yes|permissive|designated|destination
      vehicle=yes|permissive|designated|destination
    motor_vehicle=yes|permissive|designated|destination
assign initialcost switch motorvehicleaccess 0 1000000
'''
VB='switch motorcycle= motorvehicleaccess motorcycle=yes|permissive|designated|destination'
VC='switch motorcar= motorvehicleaccess motorcar=yes|permissive|designated|destination'
P={
 # name: (vehicle access expr, motorway access, track access, costs)
 'bike-rough':(VB,1,1,dict(GRAV=1.0,TRKC=1.3,TRK45=3.0,CMW=8,CT=2.5,CP=2.0,CS=1.7,CTE=1.45,CU=1.35)),
 'bike-mixed':(VB,1,1,dict(GRAV=1.1,TRKC=1.8,TRK45=5,CMW=2.2,CT=1.5,CP=1.35,CS=1.25,CTE=1.2,CU=1.2)),
 'bike-tar':  (VB,1,1,dict(GRAV=4,TRKC=8,TRK45=30,CMW=1.0,CT=1.0,CP=1.05,CS=1.15,CTE=1.25,CU=1.4)),
 'jeep-rough':(VC,1,1,dict(GRAV=1.0,TRKC=1.1,TRK45=1.6,CMW=8,CT=2.5,CP=2.0,CS=1.7,CTE=1.45,CU=1.35)),
 'jeep-mixed':(VC,1,1,dict(GRAV=1.1,TRKC=1.4,TRK45=3,CMW=2.2,CT=1.5,CP=1.35,CS=1.25,CTE=1.2,CU=1.2)),
 'jeep-tar':  (VC,1,1,dict(GRAV=4,TRKC=8,TRK45=30,CMW=1.0,CT=1.0,CP=1.05,CS=1.15,CTE=1.25,CU=1.4)),
 'car-rough': (VC,1,0,dict(GRAV=1.2,TRKC=4,TRK45=50,CMW=6,CT=2.2,CP=1.8,CS=1.5,CTE=1.3,CU=1.3)),
 'car-mixed': (VC,1,0,dict(GRAV=1.6,TRKC=8,TRK45=50,CMW=1.8,CT=1.3,CP=1.2,CS=1.2,CTE=1.2,CU=1.3)),
 'car-tar':   (VC,1,0,dict(GRAV=5,TRKC=20,TRK45=50,CMW=1.0,CT=1.0,CP=1.05,CS=1.15,CTE=1.25,CU=1.4)),
}
out={}
for k,(va,mw,trk,c) in P.items():
    s=tpl.replace('{VACC}',va).replace('{MWA}',str(mw)).replace('{TRKA}',str(trk))
    for kk,v in c.items(): s=s.replace('{'+kk+'}',str(v))
    out[k]=s
json.dump(out,open('profiles.json','w'))
print(len(out), len(out['bike-rough']))
