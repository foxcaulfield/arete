#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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
echo -e "Current version: ${YELLOW}v$CURRENT_VERSION${NC}"

# Calculate next versions based on commits since last tag
calculate_next_version() {
    local base_version=$1
    local prerelease=$2
    
    # Parse current version (strip any prerelease suffix)
    local clean_version=$(echo "$base_version" | sed -E 's/-(beta|rc|alpha)\.[0-9]+$//')
    local major=$(echo "$clean_version" | cut -d. -f1)
    local minor=$(echo "$clean_version" | cut -d. -f2)
    local patch=$(echo "$clean_version" | cut -d. -f3)
    
    # Get commits since last tag
    local last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    local commits
    if [[ -n "$last_tag" ]]; then
        commits=$(git log "$last_tag"..HEAD --oneline 2>/dev/null)
    else
        commits=$(git log --oneline 2>/dev/null)
    fi
    
    # Determine bump type from commits
    local bump="patch"
    if echo "$commits" | grep -qiE "^[a-f0-9]+ (feat!|fix!|refactor!|BREAKING CHANGE)"; then
        bump="major"
    elif echo "$commits" | grep -qiE "^[a-f0-9]+ feat"; then
        bump="minor"
    fi
    
    # Calculate new version
    case $bump in
        major) major=$((major + 1)); minor=0; patch=0 ;;
        minor) minor=$((minor + 1)); patch=0 ;;
        patch) patch=$((patch + 1)) ;;
    esac
    
    local new_version="$major.$minor.$patch"
    
    # Add prerelease suffix if needed
    if [[ -n "$prerelease" ]]; then
        # Count existing prereleases for this version
        local prerelease_num=1
        local existing_tags=$(git tag -l "v$new_version-$prerelease.*" 2>/dev/null | wc -l)
        if [[ $existing_tags -gt 0 ]]; then
            prerelease_num=$((existing_tags + 1))
        fi
        new_version="$new_version-$prerelease.$prerelease_num"
    fi
    
    echo "$new_version"
}

# Calculate and show predicted versions
echo ""
echo -e "${CYAN}📊 Predicted next versions:${NC}"
NEXT_BETA=$(calculate_next_version "$CURRENT_VERSION" "beta")
NEXT_RC=$(calculate_next_version "$CURRENT_VERSION" "rc")
NEXT_STABLE=$(calculate_next_version "$CURRENT_VERSION" "")
echo -e "   Beta (develop):  ${GREEN}v$NEXT_BETA${NC}"
echo -e "   RC (release/*):  ${GREEN}v$NEXT_RC${NC}"
echo -e "   Stable (main):   ${GREEN}v$NEXT_STABLE${NC}"
echo ""

# Menu
echo -e "${BLUE}What would you like to do?${NC}"
echo "1) Push to develop (creates beta release)"
echo "2) Create release branch (for RC)"
echo "3) Create PR to main (for stable release)"
echo "4) Merge main → develop (after release)"
echo "5) Quick push current branch"
echo "6) Exit"
echo ""
read -p "Choose an option (1-6): " choice

case $choice in
    1)
        echo -e "\n${GREEN}Pushing to develop...${NC}"
        git push origin develop
        echo -e "${GREEN}✅ Pushed! GitHub Actions will create: v$NEXT_BETA${NC}"
        echo -e "Check: ${BLUE}https://github.com/foxcaulfield/arete/actions${NC}"
        ;;
    2)
        # Suggest version from stable calculation
        SUGGESTED_VERSION=$(echo "$NEXT_STABLE" | sed -E 's/-(beta|rc|alpha)\.[0-9]+$//')
        read -p "Enter release version [$SUGGESTED_VERSION]: " VERSION
        VERSION=${VERSION:-$SUGGESTED_VERSION}
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
        
        echo -e "${YELLOW}After merging, GitHub Actions will create: v$NEXT_STABLE${NC}"
        ;;
    4)
        echo -e "\n${CYAN}Merging main into develop (back-merge after release)...${NC}"
        git fetch origin main
        git checkout develop
        git pull origin develop
        git merge origin/main -m "chore(merge): back-merge main into develop"
        git push origin develop
        echo -e "${GREEN}✅ Main merged into develop and pushed!${NC}"
        ;;
    5)
        echo -e "\n${GREEN}Pushing $CURRENT_BRANCH...${NC}"
        git push origin "$CURRENT_BRANCH"
        echo -e "${GREEN}✅ Pushed!${NC}"
        ;;
    6)
        echo -e "${BLUE}Bye! 👋${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

echo -e "\n${BLUE}📝 Commit types that affect versioning:${NC}"
echo "  feat: ...   → minor version bump (1.0.0 → 1.1.0)"
echo "  fix: ...    → patch version bump (1.0.0 → 1.0.1)"
echo "  feat!: ...  → major version bump (1.0.0 → 2.0.0)"
