// LH2 reference design RD1 — conceptual parametric geometry only.
// Units: millimetres in OpenSCAD. Classification: REFERENCE_DESIGN / ENGINEERING_CONCEPT.
// Not a real asset, not a certified design, and not a solver result.
$fn = 96;
R = 4200.000;
L = 16950.000;
BaffleX = [3400.0, 8500.0, 13600.0];

module vessel_shell() {
  rotate([0,90,0]) cylinder(h=L, r=R, center=true);
  translate([-L/2,0,0]) sphere(R);
  translate([ L/2,0,0]) sphere(R);
}

module anti_roll_baffle(x) {
  translate([x,0,0]) rotate([0,90,0]) difference() {
    cylinder(h=35, r=R*0.91, center=true);
    cylinder(h=45, r=R*0.52, center=true);
  }
}

module dip_tube() {
  translate([-L/2+600,0,-R*0.55]) rotate([0,90,0]) cylinder(h=L-1200, r=42, center=false);
}

module leak_orifice() {
  translate([10509.00,0,3750.00]) rotate([0,90,0]) cylinder(h=240, r=180.00, center=true);
}

// Exploded conceptual solids for design documentation.
color("lightsteelblue", 0.35) vessel_shell();
for (x = BaffleX) color("orange", 0.55) anti_roll_baffle(x);
color("silver", 0.9) dip_tube();
color("red", 0.9) leak_orifice();
