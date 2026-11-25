-- File: supabase/migrations/20261130100000_checklist_18_items.sql
-- (NEW file)
-- =========================================================
-- Daily pre-trip checklist: 18 items (client's 9 + 9 more).
-- "No" holds the trip on: logs, fire extinguisher / triangles, phone mount,
-- ELD device, radar / alcohol / passengers, brakes, tires.
-- Old pre-trips keep the items the driver saw.
-- Admins can still change the list in Settings.
-- =========================================================
update public.settings
   set pre_trip_items = '[
    {"key": "logs", "label": "Logs current, plus 8 days of blank paper log sheets", "hint": "Logs are up to date and 8 days of blank paper log sheets are in the truck", "blocksTrip": true, "ticket": false, "scored": true},
    {"key": "safety_kit", "label": "Fire extinguisher charged and mounted, plus 3 warning triangles", "hint": "Gauge in the green, mounted, and 3 triangles in the truck", "blocksTrip": true, "ticket": false, "scored": true},
    {"key": "phone_mount", "label": "Phone mounted in a fixed holder (the phone is the ELD)", "hint": "In the holder, not loose on the seat or dash", "blocksTrip": true, "ticket": false, "scored": true},
    {"key": "eld_connected", "label": "ELD device plugged into the truck and connected", "hint": "Plugged in, powered on and connected to the phone app", "blocksTrip": true, "ticket": false, "scored": true},
    {"key": "no_prohibited", "label": "No radar detector, no alcohol, and no unauthorized passengers", "hint": "Nothing like this in the cab, and only approved riders", "blocksTrip": true, "ticket": false, "scored": true},
    {"key": "shipping_papers", "label": "Bill of lading and inventory for every shipment", "hint": "And weight tickets when needed", "blocksTrip": false, "ticket": false, "scored": true},
    {"key": "cab_secured", "label": "Loose items in the cab secured", "hint": "Nothing that can fly around in a hard stop", "blocksTrip": false, "ticket": false, "scored": true},
    {"key": "brake_leaks", "label": "Brakes: no leaks", "hint": "No air or fluid leaks", "blocksTrip": true, "ticket": true, "scored": false},
    {"key": "parking_brake", "label": "Parking brake working", "hint": "Holds the truck when set", "blocksTrip": false, "ticket": true, "scored": false},
    {"key": "all_lights", "label": "All lights working", "hint": "Head, tail, brake, turn signals and markers", "blocksTrip": false, "ticket": true, "scored": false},
    {"key": "plate_light", "label": "License plate light working", "hint": "The rear plate is lit", "blocksTrip": false, "ticket": true, "scored": false},
    {"key": "tires_wheels", "label": "Tires and wheels", "hint": "Good tread, no damage, no loose or missing lug nuts", "blocksTrip": true, "ticket": true, "scored": false},
    {"key": "cab_glass", "label": "Windshield, wipers, mirrors, horn, seatbelt", "hint": "No cracks, everything works", "blocksTrip": false, "ticket": true, "scored": false},
    {"key": "fuel_leaks", "label": "No fuel, oil or exhaust leaks", "hint": "Under the truck and around the engine", "blocksTrip": false, "ticket": true, "scored": false},
    {"key": "fuel_cap", "label": "Fuel cap on", "hint": "Closed and tight", "blocksTrip": false, "ticket": true, "scored": false},
    {"key": "battery_steering", "label": "Battery secured, and steering not loose", "hint": "Battery tied down, and no extra play in the steering wheel", "blocksTrip": false, "ticket": true, "scored": false},
    {"key": "license_plate", "label": "License plate on and readable", "hint": "Clean and easy to read", "blocksTrip": false, "ticket": true, "scored": false},
    {"key": "load_doors", "label": "Load secured, and doors latching", "hint": "Straps and load bars in place, every door latches", "blocksTrip": false, "ticket": false, "scored": true}
  ]'::jsonb
 where id = 1;