#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Arete Release Helper${NC}\n"

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "Current branch: ${YELLOW}$CURRENT_BRANCH${NC}"

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${RED}❌ You have uncommitted changes. Please commit or stash them first.${NC}"
    exit 1
fi

# Show current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "Current version: ${YELLOW}v$CURRENT_VERSION${NC}\n"

# Menu
echo -e "${BLUE}What would you like to do?${NC}"
echo "1) Push to develop (creates beta release)"
echo "2) Create release branch (for RC)"
echo "3) Create PR to main (for stable release)"
echo "4) Quick push current branch"
echo "5) Exit"
echo ""
read -p "Choose an option (1-5): " choice

case $choice in
    1)
        echo -e "\n${GREEN}Pushing to develop...${NC}"
        git push origin develop
        echo -e "${GREEN}✅ Pushed! GitHub Actions will create a beta release.${NC}"
        echo -e "Check: ${BLUE}https://github.com/foxcaulfield/arete/actions${NC}"
        ;;
    2)
        read -p "Enter release version (e.g., 1.5.0): " VERSION
        RELEASE_BRANCH="release/$VERSION"
        echo -e "\n${GREEN}Creating release branch: $RELEASE_BRANCH${NC}"
        git checkout -b "$RELEASE_BRANCH"
        git push -u origin "$RELEASE_BRANCH"
        echo -e "${GREEN}✅ Release branch created and pushed!${NC}"
        echo -e "GitHub Actions will create RC releases on this branch."
        ;;
    3)
        echo -e "\n${GREEN}Opening GitHub to create PR to main...${NC}"
        
        # Try to open browser
        URL="https://github.com/foxcaulfield/arete/compare/main...$CURRENT_BRANCH?expand=1"
        
        if command -v xdg-open &> /dev/null; then
            xdg-open "$URL"
        elif command -v open &> /dev/null; then
            open "$URL"
        else
            echo -e "Open this URL manually: ${BLUE}$URL${NC}"
        fi
        
        echo -e "${YELLOW}After merging the PR, GitHub Actions will create a stable release.${NC}"
        ;;
    4)
        echo -e "\n${GREEN}Pushing $CURRENT_BRANCH...${NC}"
        git push origin "$CURRENT_BRANCH"
        echo -e "${GREEN}✅ Pushed!${NC}"
        ;;
    5)
        echo -e "${BLUE}Bye! 👋${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

echo -e "\n${BLUE}📝 Remember: Use conventional commits for automatic versioning:${NC}"
echo "  feat: ...   → minor version bump (1.0.0 → 1.1.0)"
echo "  fix: ...    → patch version bump (1.0.0 → 1.0.1)"
echo "  BREAKING CHANGE: ... → major version bump (1.0.0 → 2.0.0)"
