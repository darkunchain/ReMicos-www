import { Component, OnInit } from '@angular/core';
import { faFacebook, faFacebookF} from '@fortawesome/free-brands-svg-icons'
import { faInstagram} from '@fortawesome/free-brands-svg-icons'
import { faHome } from '@fortawesome/free-solid-svg-icons'
import { Router } from '@angular/router';



@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {

  faFacebook = faFacebook;
  faInstagram = faInstagram;
  faHome = faHome

  constructor(private router: Router) { }

  gotoHome(){
    this.router.navigate(['/home']);  // define your component where you want to go
}

  ngOnInit(): void {
  }

}
