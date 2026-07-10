#!/bin/bash
# Test the MikroTik API from the VPS
echo "--- MikroTik Bridge Verification ---"
echo "Testing connection to 10.0.0.2..."
curl -v -u admin:Hazy.123 http://10.0.0.2/rest/system/identity
echo "------------------------------------"
