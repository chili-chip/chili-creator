// Shows whether the game on the Chili account is up to date, in the toolbar.
// Clicking it saves now, or retries after a failed save.
(function () {
	var labels = {
		saved: "saved",
		saving: "saving…",
		unsaved: "unsaved changes",
		error: "not saved, retry",
	};

	var titles = {
		saved: "All changes are saved",
		saving: "Saving your changes…",
		unsaved: "You have changes that are not saved yet. Click to save now",
	};

	function paint(button, save) {
		var label = labels[save.state] || labels.saved;
		var title = titles[save.state] || titles.saved;
		if (save.state === "saved" && save.isNew) {
			label = "new game";
			title = "Edits are saved to your profile as you go";
		}
		if (save.state === "error") {
			title = "Could not save" + (save.error ? ": " + save.error : "") + ". Click to try again";
		}
		button.dataset.state = save.state;
		button.title = title;
		button.setAttribute("aria-disabled", String(save.state === "saved" || save.state === "saving"));
		button.querySelector(".save-status-text").textContent = label;
	}

	document.addEventListener("DOMContentLoaded", function () {
		var button = document.getElementById("saveStatus");
		if (!button || !window.ChiliProjects) {
			return;
		}
		button.onclick = function () {
			if (button.getAttribute("aria-disabled") === "true") {
				return;
			}
			ChiliProjects.saveNow().catch(function () {});
		};
		ChiliProjects.watch(function (state) {
			// A chili-projects.js from before v0.2.0 reports no save status.
			if (state && state.save) {
				paint(button, state.save);
			}
		});
	});
})();
