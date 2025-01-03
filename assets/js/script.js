'use strict';

// element toggle function
const elementToggleFunc = function (elem) {
  elem.classList.toggle("active");
};

// sidebar variables
const sidebar = document.querySelector("[data-sidebar]");
const sidebarBtn = document.querySelector("[data-sidebar-btn]");

// sidebar toggle functionality for mobile
sidebarBtn.addEventListener("click", function () {
  elementToggleFunc(sidebar);
});

// custom select variables
const select = document.querySelector("[data-select]");
const selectItems = document.querySelectorAll("[data-select-item]");
const selectValue = document.querySelector("[data-selecct-value]");
const filterBtn = document.querySelectorAll("[data-filter-btn]");

// Fetch projects.json and populate project list
const projectList = document.getElementById("project-list");

fetch("../data/projects.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error("Failed to load projects.json");
    }
    return response.json();
  })
  .then((projects) => {
    // Clear the list before populating
    projectList.innerHTML = "";

    if (projects.length === 0) {
      projectList.innerHTML = "<p>No projects to display.</p>";
      return;
    }

    projects.forEach((project) => {
      const projectItem = document.createElement("li");
      projectItem.classList.add("project-item", "active");
      projectItem.setAttribute("data-filter-item", "");
      projectItem.setAttribute("data-category", project.category);

      projectItem.innerHTML = `
        <a href="${project.link}">
          <figure class="project-img">
            <div class="project-item-icon-box">
              <ion-icon name="eye-outline"></ion-icon>
            </div>
            <img src="${project.image}" alt="${project.alt}" loading="lazy" />
          </figure>
          <h3 class="project-title">${project.title}</h3>
          <p class="project-category">${project.category}</p>
        </a>
      `;

      projectList.appendChild(projectItem);
    });
  })
  .catch((error) => {
    console.error("Error loading projects:", error);
    projectList.innerHTML = "<p>Error loading projects. Please try again later.</p>";
  });

if (select) {
  select.addEventListener("click", function () {
    elementToggleFunc(this);
  });
}

// add event in all select items
for (let i = 0; i < selectItems.length; i++) {
  selectItems[i].addEventListener("click", function () {
    let selectedValue = this.innerText.toLowerCase();
    selectValue.innerText = this.innerText;
    elementToggleFunc(select);
    filterFunc(selectedValue);
  });
}

// filter function
const filterFunc = function (selectedValue) {
  const filterItems = document.querySelectorAll("[data-filter-item]"); // Dynamically get filter items

  for (let i = 0; i < filterItems.length; i++) {
    if (selectedValue === "all") {
      filterItems[i].classList.add("active");
    } else if (selectedValue === filterItems[i].dataset.category.toLowerCase()) {
      filterItems[i].classList.add("active");
    } else {
      filterItems[i].classList.remove("active");
    }
  }
};

// add event in all filter button items for large screen
let lastClickedBtn = filterBtn[0];

for (let i = 0; i < filterBtn.length; i++) {
  filterBtn[i].addEventListener("click", function () {
    let selectedValue = this.innerText.toLowerCase();
    selectValue.innerText = this.innerText;
    filterFunc(selectedValue);

    lastClickedBtn.classList.remove("active");
    this.classList.add("active");
    lastClickedBtn = this;
  });
}
