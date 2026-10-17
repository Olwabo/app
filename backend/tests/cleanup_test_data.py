# Utility: list/delete TEST_ prefixed sites, nodes, members and open incidents for owner org
import sys
from conftest import Client, token_for, OWNER

c = Client(token_for(*OWNER))
delete = "--delete" in sys.argv
sites = c.rest("sites", "name=like.TEST_*&select=id,name")
nodes = c.rest("sensor_nodes", "or=(device_eui.like.TEST*,label.like.TEST_*)&select=id,device_eui,label,status")
team = [m for m in c.api("GET", "/team").json() if m["email"].startswith("test_")]
open_inc = c.rest("incident_alerts", "status=neq.RESOLVED&select=id,category,node_id,status")
print("sites", sites, "\nnodes", nodes, "\nteam", team, "\nopen incidents", open_inc)
print("tariff", c.api("GET", "/me").json()["tariff_zar_per_kl"], "alerts", c.api("GET", "/org/alert-settings").json())
if delete:
    for n in nodes:
        print("del node", c.api("DELETE", f"/nodes/{n['id']}").status_code)
    for s in sites:
        print("del site", c.api("DELETE", f"/sites/{s['id']}").status_code)
    for m in team:
        print("del member", c.api("DELETE", f"/team/{m['id']}").status_code)
    if "--resolve" in sys.argv:
        for i in open_inc:
            print("resolve", c.api("POST", f"/incidents/{i['id']}/resolve").status_code)
