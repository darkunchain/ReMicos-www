import { Component, OnInit } from '@angular/core';
import { faFacebook, faFacebookF} from '@fortawesome/free-brands-svg-icons'
import { faInstagram} from '@fortawesome/free-brands-svg-icons'
import { faHome } from '@fortawesome/free-solid-svg-icons'


@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {

  faFacebook = faFacebook;
  faInstagram = faInstagram;
  faHome = faHome

  constructor() { }

  ngOnInit(): void {
  }

}
