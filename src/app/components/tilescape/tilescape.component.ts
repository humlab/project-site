import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-tilescape',
  templateUrl: './tilescape.component.html',
  styleUrls: ['./tilescape.component.scss']
})
export class TilescapeComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

  gotoProject(projectPath) {
    window.location.href = projectPath;
  }

  getCurrentYear() {
    return new Date().getFullYear();
  }

}
