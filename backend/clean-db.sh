#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}⚠️  WARNING: This will delete ALL data EXCEPT users!${NC}"
echo -e "${YELLOW}⚠️  Make sure you have a backup if needed.${NC}"
echo
echo -e "The following will happen:"
echo -e "1. All tables except 'users' will be truncated"
echo -e "2. All relationships will be reset"
echo -e "3. User data will be preserved"
echo
read -p "Are you sure you want to proceed? (type 'yes' to confirm) " -r
echo

if [[ $REPLY == "yes" ]]; then
    echo -e "${GREEN}Starting cleanup...${NC}"
    node src/scripts/clean-all-except-users.js
else
    echo -e "${RED}Cleanup cancelled.${NC}"
    exit 1
fi 