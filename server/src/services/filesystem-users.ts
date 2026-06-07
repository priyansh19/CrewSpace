import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "../middleware/logger.js";

const execAsync = promisify(exec);

/**
 * Converts an agent name to a valid Unix username.
 * Rules: lowercase, alphanumeric + underscore + hyphen, must start with letter/underscore, max 32 chars.
 */
export function sanitizeUsername(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/^[^a-z_]/, "_")
    .replace(/_+/g, "_")
    .slice(0, 32)
    .replace(/[_-]+$/, "");
  return sanitized || "agent";
}

async function userExists(username: string): Promise<boolean> {
  try {
    await execAsync(`id "${username}"`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates an OS user for a newly hired CrewSpace agent.
 * CEO agents are added to the sudo group for root-equivalent access.
 * Non-fatal: errors are logged but never thrown.
 */
export async function provisionAgentUser(agent: {
  id: string;
  name: string;
  role: string;
}): Promise<void> {
  const username = sanitizeUsername(agent.name);

  if (await userExists(username)) {
    logger.info({ username, agentId: agent.id }, "filesystem-users: user already exists, skipping");
    return;
  }

  try {
    await execAsync(
      `sudo useradd --create-home --shell /bin/bash --comment "crewspace-agent:${agent.id}" "${username}"`,
    );
    logger.info({ username, agentId: agent.id, role: agent.role }, "filesystem-users: created OS user");
  } catch (err) {
    logger.error({ err, username, agentId: agent.id }, "filesystem-users: failed to create OS user");
    return;
  }

  if (agent.role === "ceo") {
    // Try sudo (Debian/Ubuntu) then wheel (RHEL/CentOS/Fedora)
    let granted = false;
    for (const group of ["sudo", "wheel"]) {
      try {
        await execAsync(`getent group "${group}"`);
        await execAsync(`sudo usermod -aG "${group}" "${username}"`);
        logger.info({ username, group }, "filesystem-users: granted elevated access to CEO agent");
        granted = true;
        break;
      } catch {
        // group doesn't exist, try next
      }
    }
    if (!granted) {
      logger.warn({ username }, "filesystem-users: no sudo/wheel group found — CEO agent created without elevated access");
    }
  }
}

/**
 * Removes the OS user for a terminated/deleted CrewSpace agent.
 * Non-fatal: errors are logged but never thrown.
 */
export async function deprovisionAgentUser(agent: {
  id: string;
  name: string;
}): Promise<void> {
  const username = sanitizeUsername(agent.name);

  if (!(await userExists(username))) {
    return;
  }

  try {
    await execAsync(`sudo userdel --remove "${username}"`);
    logger.info({ username, agentId: agent.id }, "filesystem-users: removed OS user");
  } catch (err) {
    logger.error({ err, username, agentId: agent.id }, "filesystem-users: failed to remove OS user");
  }
}
