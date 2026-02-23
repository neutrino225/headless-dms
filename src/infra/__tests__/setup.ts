import { existsSync } from "node:fs";

/**
 * Setup file to configure Testcontainers for Podman if needed.
 * This helps when the environment doesn't have DOCKER_HOST set.
 */

const uid = process.getuid?.() ?? 1000;
const podmanUserSocket = `/run/user/${uid}/podman/podman.sock`;
const podmanRootSocket = "/run/podman/podman.sock";

// Always configure DOCKER_HOST for Podman if a socket is available
// and DOCKER_HOST is not already pointing to a valid Docker/Podman socket.
const currentHost = process.env.DOCKER_HOST;
const needsConfig =
	!currentHost || !existsSync(currentHost.replace(/^unix:\/\//, ""));

if (needsConfig) {
	if (existsSync(podmanUserSocket)) {
		process.env.DOCKER_HOST = `unix://${podmanUserSocket}`;
		console.log(
			`[Test Setup] Setting DOCKER_HOST to Podman user socket: ${process.env.DOCKER_HOST}`,
		);
	} else if (existsSync(podmanRootSocket)) {
		process.env.DOCKER_HOST = `unix://${podmanRootSocket}`;
		console.log(
			`[Test Setup] Setting DOCKER_HOST to Podman root socket: ${process.env.DOCKER_HOST}`,
		);
	}
}

// Podman often requires Ryuk to be disabled or configured differently
if (process.env.TESTCONTAINERS_RYUK_DISABLED === undefined) {
	process.env.TESTCONTAINERS_RYUK_DISABLED = "true";
	console.log("[Test Setup] Disabling Ryuk for Podman compatibility");
}
