import { Component, OnInit } from '@angular/core';
import { faFacebook, faFacebookF, faFacebookMessenger, faFacebookSquare} from '@fortawesome/free-brands-svg-icons'
import { faInstagram} from '@fortawesome/free-brands-svg-icons'


@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent implements OnInit {


  faFacebook = faFacebook;
  faFacebookF = faFacebookF;
  faInstagram = faInstagram

  constructor() { }

  ngOnInit(): void {
  }

}
