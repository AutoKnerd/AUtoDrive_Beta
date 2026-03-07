#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(pwd)"

print_header() {
  printf "\n%s\n" "$1"
  printf "%s\n" "$(printf '%.0s-' {1..72})"
}

ok() {
  printf "[OK] %s\n" "$1"
}

warn() {
  printf "[WARN] %s\n" "$1"
}

info() {
  printf "[INFO] %s\n" "$1"
}

print_header "AutoDrive Vercel Deploy Check"
info "Project: ${PROJECT_DIR}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  warn "Not inside a Git repository."
  exit 1
fi

REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || true)"
UPSTREAM_REF="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"

print_header "1) Git Link Check"
if [[ -n "${REMOTE_URL}" ]]; then
  ok "origin is set: ${REMOTE_URL}"
else
  warn "No origin remote configured. Vercel cannot auto-deploy from this clone."
fi

if [[ "${REMOTE_URL}" == *"github.com/AutoKnerd/autodrive_web"* ]]; then
  ok "Remote matches expected repo family (AutoKnerd/autodrive_web)."
else
  warn "Remote does not look like AutoKnerd/autodrive_web. Confirm you're pushing to the intended GitHub repo."
fi

print_header "2) Branch Check"
if [[ -n "${CURRENT_BRANCH}" ]]; then
  info "Current branch: ${CURRENT_BRANCH}"
else
  warn "Could not determine current branch."
fi

if [[ -n "${UPSTREAM_REF}" ]]; then
  ok "Upstream tracking branch: ${UPSTREAM_REF}"
else
  warn "No upstream tracking branch set. Push with: git push -u origin ${CURRENT_BRANCH:-main}"
fi

print_header "3) Push/Sync Check"
if git fetch --quiet origin; then
  if [[ -n "${UPSTREAM_REF}" ]]; then
    AHEAD_BEHIND="$(git rev-list --left-right --count "${UPSTREAM_REF}"...HEAD 2>/dev/null || true)"
    BEHIND_COUNT="$(awk '{print $1}' <<<"${AHEAD_BEHIND}")"
    AHEAD_COUNT="$(awk '{print $2}' <<<"${AHEAD_BEHIND}")"

    if [[ "${AHEAD_COUNT:-0}" -gt 0 ]]; then
      warn "You have ${AHEAD_COUNT} local commit(s) not yet on ${UPSTREAM_REF}."
    else
      ok "No local commits waiting to be pushed."
    fi

    if [[ "${BEHIND_COUNT:-0}" -gt 0 ]]; then
      warn "Your local branch is behind ${UPSTREAM_REF} by ${BEHIND_COUNT} commit(s)."
    else
      ok "Local branch is up to date with ${UPSTREAM_REF}."
    fi
  else
    info "Skipping ahead/behind check because no upstream is configured."
  fi
else
  warn "Could not fetch origin. Network/auth issue may prevent clean deployment checks."
fi

print_header "4) Vercel Dashboard Checks (manual)"
info "Open Vercel -> Project -> Settings -> Git and confirm all 4:"
printf "  [ ] Connected Git Repository is this exact repo.\n"
printf "  [ ] Production Branch matches the branch you push (usually 'main').\n"
printf "  [ ] Automatically deploy production branch is enabled.\n"
printf "  [ ] New GitHub commit appears under Deployments after push.\n"

print_header "What can be fixed in code vs Vercel UI"
info "This script verifies local Git wiring."
info "Repo connection, production-branch toggle, and auto-deploy live in Vercel settings."
