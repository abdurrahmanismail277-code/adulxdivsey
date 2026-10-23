  function switchTab(tabName, button) {
    document.querySelectorAll(".tab-btn").forEach((button) => button.classList.remove("active"));
    document.querySelectorAll(".plans-group").forEach((group) => group.classList.remove("active"));

    const tabButton = button || document.querySelector(`.tab-btn[onclick*="${tabName}"]`);
    const tabPanel = document.getElementById(`tab-${tabName}`);

    if (tabButton) tabButton.classList.add("active");
    if (tabPanel) tabPanel.classList.add("active");
  }

  function switchTabFooter(tabName) {
    switchTab(tabName);
  }

