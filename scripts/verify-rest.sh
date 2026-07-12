#!/bin/bash
# Final REST API Verification
echo "--- MikroTik REST API Verification ---"
curl -v -u admin:Hazy.123 http://10.0.0.2/rest/system/identity
echo "--------------------------------------"
