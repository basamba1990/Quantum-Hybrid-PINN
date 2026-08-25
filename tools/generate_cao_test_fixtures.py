from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "fixtures" / "step"
OUT.mkdir(parents=True, exist_ok=True)

HEADER = """ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('QUANTUM-HYBRID-PINN TEST FIXTURE - NOT INDUSTRIAL CAD'),'2;1');
FILE_NAME('fixture','2026-08-25T00:00:00',('test'),('test'),'Quantum-Hybrid-PINN','test-generator','');
FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF { 1 0 10303 442 1 1 }'));
ENDSEC;
DATA;
#10=SI_UNIT(.MILLI.,.METRE.,.LENGTH_UNIT.);
#11=APPLICATION_PROTOCOL_DEFINITION('international standard','ap242_managed_model_based_3d_engineering',2013,#12);
#12=APPLICATION_CONTEXT('configuration controlled 3d designs of mechanical parts and assemblies');
"""

POINTS = {
    100: (1000, 0, 0),
    101: (-1000, 0, 0),
    102: (0, 1000, 0),
    103: (0, -1000, 0),
    104: (0, 0, 1000),
    105: (0, 0, -1000),
}

FACES = [
    (200, (100, 102, 104)),
    (201, (102, 101, 104)),
    (202, (101, 103, 104)),
    (203, (103, 100, 104)),
    (204, (102, 100, 105)),
    (205, (101, 102, 105)),
    (206, (103, 101, 105)),
    (207, (100, 103, 105)),
]


def entity_lines(include_faces):
    lines = []
    for point_id, xyz in POINTS.items():
        lines.append(f"#{point_id}=CARTESIAN_POINT('',({xyz[0]}.0,{xyz[1]}.0,{xyz[2]}.0));")
    for face_id, refs in include_faces:
        lines.append(f"#{face_id}=POLYGON('',(#{refs[0]},#{refs[1]},#{refs[2]}));")
    return lines


def write(name, shell_type, faces):
    ids = ",".join(f"#{face_id}" for face_id, _ in faces)
    content = HEADER + "\n".join(entity_lines(faces)) + f"\n#300={shell_type}('',({ids}));\nENDSEC;\nEND-ISO-10303-21;\n"
    (OUT / name).write_text(content, encoding="utf-8")


write("closed_octahedron_ap242.step", "CLOSED_SHELL", FACES)
write("lh2_tank_ap242.step", "OPEN_SHELL", FACES[:-1])
(OUT / "README.md").write_text(
    "# STEP test fixtures\n\n"
    "These deterministic AP242-labelled text fixtures are test inputs only.\n"
    "They are not industrial equipment, not LH2 tank geometry, and must never\n"
    "be used as evidence for G0-G5 industrial validation.\n",
    encoding="utf-8",
)
